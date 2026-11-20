'use strict';

const { randomUUID } = require('crypto');
const Subject = require('./Subject');

/**
 * EventBus (Singleton + Observer subject)
 * ---------------------------------------
 * Services publish domain events ("a reservation was cancelled") without knowing who
 * cares. Observers (notifications, audit log, ...) subscribe once at start-up.
 * This keeps the reservation code free of notification and auditing concerns.
 */
class EventBus extends Subject {
  static #instance = null;

  static getInstance() {
    if (!EventBus.#instance) EventBus.#instance = new EventBus();
    return EventBus.#instance;
  }

  static reset() {
    if (EventBus.#instance) EventBus.#instance.clear();
    EventBus.#instance = null;
  }

  /**
   * Publish an event and wait until every observer has handled it.
   * @param {string} name one of the names in core/events.js
   * @param {object} payload plain, serialisable data
   */
  async publish(name, payload = {}) {
    const event = Object.freeze({ id: randomUUID(), name, payload, occurredAt: new Date() });
    await this.notify(event);
    return event;
  }
}

module.exports = EventBus;
