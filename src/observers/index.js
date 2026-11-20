'use strict';

const EventBus = require('../core/EventBus');
const AuditObserver = require('./AuditObserver');

const registered = new WeakMap();

/**
 * Subscribe every observer to the event bus. Safe to call more than once for the same bus.
 * @returns {() => void} unsubscribe everything
 */
function registerObservers(bus = EventBus.getInstance()) {
  if (registered.has(bus)) return registered.get(bus);
  const offs = [new AuditObserver().subscribeTo(bus)];
  const unregister = () => {
    offs.forEach((off) => off());
    registered.delete(bus);
  };
  registered.set(bus, unregister);
  return unregister;
}

module.exports = { registerObservers };
