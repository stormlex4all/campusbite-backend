'use strict';

const AuditLog = require('../modules/admin/auditLog.model');

/**
 * AuditObserver (Observer pattern)
 * --------------------------------
 * Every `admin.*` event is written to the audit log with the administrator's details and the time.
 * Admin services only publish events; this observer decides how they are recorded.
 */
class AuditObserver {
  subscribeTo(subject) {
    return subject.subscribe('admin.*', this);
  }

  async update(event) {
    const { actor, target, details } = event.payload;
    await AuditLog.create({
      action: event.name,
      actor: { id: actor.id, name: actor.name, email: actor.email },
      target: target ? { id: target.id, name: target.name, email: target.email, role: target.role } : undefined,
      details,
    });
  }
}

module.exports = AuditObserver;
