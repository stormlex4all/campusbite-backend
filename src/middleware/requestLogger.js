'use strict';

const Logger = require('../core/Logger');

const requestLogger = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    Logger.getInstance().info(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};

module.exports = requestLogger;
