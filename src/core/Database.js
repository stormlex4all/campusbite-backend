'use strict';

const mongoose = require('mongoose');
const Config = require('../config');
const Logger = require('./Logger');

/**
 * Database (Singleton)
 * --------------------
 * Owns the one Mongoose connection of the process and answers one important
 * question for the rest of the code: "can I use multi-document transactions?"
 *
 *  - Replica sets (and MongoDB Atlas) support transactions.
 *  - A standalone `mongod` does not. In that case `withTransaction` simply runs the
 *    work without a session and services rely on atomic conditional updates plus
 *    compensation (see reservation.service.js).
 */
class Database {
  static #instance = null;
  #transactionsEnabled = false;

  static getInstance() {
    if (!Database.#instance) Database.#instance = new Database();
    return Database.#instance;
  }

  static reset() {
    Database.#instance = null;
  }

  get transactionsEnabled() {
    return this.#transactionsEnabled;
  }

  get isConnected() {
    return mongoose.connection.readyState === 1;
  }

  async connect(uri = Config.get().db.uri) {
    if (this.isConnected) return mongoose.connection;
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await this.#detectTransactionSupport();
    Logger.getInstance().info('MongoDB connected', {
      database: mongoose.connection.name,
      transactions: this.#transactionsEnabled,
    });
    return mongoose.connection;
  }

  async disconnect() {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    this.#transactionsEnabled = false;
  }

  /** @returns {Promise<boolean>} true when the server answers a ping */
  async ping() {
    if (!this.isConnected) return false;
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run `work(session)` atomically when transactions are available, otherwise run
   * `work(null)`. The callback may be retried by the driver on transient errors, so
   * it must not have side effects outside the database.
   */
  async withTransaction(work) {
    if (!this.#transactionsEnabled) return work(null);
    // Connection#transaction wraps the driver's withTransaction and also resets the state of
    // Mongoose documents when an attempt is retried, which a hand-written wrapper would not.
    return mongoose.connection.transaction((session) => work(session));
  }

  async #detectTransactionSupport() {
    const mode = Config.get().db.useTransactions;
    if (mode === 'true') {
      this.#transactionsEnabled = true;
      return;
    }
    if (mode === 'false') {
      this.#transactionsEnabled = false;
      return;
    }
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      this.#transactionsEnabled = Boolean(hello.setName) || hello.msg === 'isdbgrid';
    } catch {
      this.#transactionsEnabled = false;
    }
  }
}

module.exports = Database;
