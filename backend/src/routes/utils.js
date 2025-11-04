const winston = require('winston');

// Configure winston logger
const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log' })
    ]
});

// Helper function for error handling
const handleError = (res, error) => {
    logger.error({ message: error.message, stack: error.stack });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
};

module.exports = { handleError };
