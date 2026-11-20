'use strict';

const Config = require('../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

/**
 * Logger (Singleton)
 * ------------------
 * One logger for the whole process. JSON lines in production (easy to ship to a log
 * service), readable single lines in development, silent in tests.
 */
class Logger {
  static #instance = null;

  static getInstance() {
    if (!Logger.#instance) Logger.#instance = new Logger();
    return Logger.#instance;
  }

  static reset() {
    Logger.#instance = null;
  }

  constructor() {
    const config = Config.get();
    this.threshold = LEVELS[config.logging.level];
    this.json = config.isProduction;
  }

  debug(message, meta) {
    this.#write('debug', message, meta);
  }

  info(message, meta) {
    this.#write('info', message, meta);
  }

  warn(message, meta) {
    this.#write('warn', message, meta);
  }

  error(message, meta) {
    this.#write('error', message, meta);
  }

  #write(level, message, meta) {
    if (LEVELS[level] < this.threshold) return;
    const entry = { time: new Date().toISOString(), level, message };
    if (meta !== undefined) entry.meta = meta instanceof Error ? serializeError(meta) : meta;
    const stream = level === 'error' || level === 'warn' ? console.error : console.log;
    if (this.json) {
      stream(JSON.stringify(entry));
    } else {
      const extra = entry.meta !== undefined ? ` ${safeStringify(entry.meta)}` : '';
      stream(`${entry.time} ${level.toUpperCase().padEnd(5)} ${message}${extra}`);
    }
  }
}

function serializeError(err) {
  return { name: err.name, message: err.message, code: err.code, stack: err.stack };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value instanceof Error ? serializeError(value) : value);
  } catch {
    return String(value);
  }
}

module.exports = Logger;
