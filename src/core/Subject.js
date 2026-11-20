'use strict';

const Logger = require('./Logger');

/**
 * Subject (Observer pattern)
 * --------------------------
 * A tiny, dependency free implementation of the Observer pattern.
 *
 *  - An *observer* is either a function `(event) => void` or an object with an
 *    `update(event)` method.
 *  - Observers subscribe to an event name, a prefix wildcard such as `admin.*`,
 *    or `*` for everything.
 *  - `notify(event)` delivers the event to every matching observer. One failing
 *    observer never stops the others and never breaks the request that published
 *    the event; the failure is logged instead.
 */
class Subject {
  /** @type {Map<string, Set<object|Function>>} */
  #observers = new Map();

  /**
   * @param {string} pattern event name, `prefix.*` or `*`
   * @param {Function|{update: Function}} observer
   * @returns {() => void} call it to unsubscribe
   */
  subscribe(pattern, observer) {
    if (typeof pattern !== 'string' || !pattern) throw new TypeError('An event name or pattern is required.');
    if (typeof observer !== 'function' && typeof observer?.update !== 'function') {
      throw new TypeError('An observer must be a function or an object with an update(event) method.');
    }
    if (!this.#observers.has(pattern)) this.#observers.set(pattern, new Set());
    this.#observers.get(pattern).add(observer);
    return () => this.unsubscribe(pattern, observer);
  }

  unsubscribe(pattern, observer) {
    const set = this.#observers.get(pattern);
    if (!set) return false;
    const removed = set.delete(observer);
    if (set.size === 0) this.#observers.delete(pattern);
    return removed;
  }

  /** Number of observers that would receive an event with this exact name. */
  observerCount(eventName) {
    return this.#matching(eventName).length;
  }

  /** Remove every observer (used by tests). */
  clear() {
    this.#observers.clear();
  }

  /**
   * Deliver an event to all matching observers and wait for them to finish.
   * @param {{name: string}} event
   * @returns {Promise<{delivered: number, failed: number}>}
   */
  async notify(event) {
    const targets = this.#matching(event.name);
    const results = await Promise.allSettled(
      targets.map(async (observer) => (typeof observer === 'function' ? observer(event) : observer.update(event))),
    );
    let failed = 0;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed += 1;
        const target = targets[index];
        Logger.getInstance().error(`Observer failed while handling "${event.name}"`, {
          observer: target.constructor?.name || target.name || 'anonymous',
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
    return { delivered: targets.length - failed, failed };
  }

  #matching(eventName) {
    const matches = [];
    for (const [pattern, set] of this.#observers) {
      if (pattern === '*' || pattern === eventName || (pattern.endsWith('.*') && eventName.startsWith(pattern.slice(0, -1)))) {
        matches.push(...set);
      }
    }
    return matches;
  }
}

module.exports = Subject;
