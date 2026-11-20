'use strict';

require('dotenv').config({ quiet: true });

const Config = require('./config');
const Logger = require('./core/Logger');
const Database = require('./core/Database');
const { registerObservers } = require('./observers');
const createApp = require('./app');

async function main() {
  const config = Config.get();
  const logger = Logger.getInstance();
  const db = Database.getInstance();

  await db.connect();
  registerObservers();

  const app = createApp();
  const server = app.listen(config.server.port, () => {
    logger.info(`CampusBite API listening on http://localhost:${config.server.port}`, { env: config.env });
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await db.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start CampusBite API:', err);
  process.exit(1);
});
