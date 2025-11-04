// src/config/logger.js
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file'); // ensure DailyRotateFile is loaded

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

module.exports = logger; // <-- CommonJS export
