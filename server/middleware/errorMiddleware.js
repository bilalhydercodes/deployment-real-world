const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';
    logger.error('request_error', {
        method: req.method,
        path: req.originalUrl,
        error: err.message,
        name: err.name,
    });

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            code: 'INVALID_FIELD_VALUE',
            message: `Invalid value for field '${err.path}': ${err.value}`,
        });
    }

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: messages.join('. '),
        });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(400).json({
            success: false,
            code: 'DUPLICATE_VALUE',
            message: `'${err.keyValue?.[field]}' is already registered for ${field}. Please use a different value.`,
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Invalid token. Please log in again.',
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            code: 'TOKEN_EXPIRED',
            message: 'Your session has expired. Please log in again.',
        });
    }

    const statusCode = err.statusCode && err.statusCode >= 100 ? err.statusCode : 500;

    res.status(statusCode).json({
        success: false,
        code: err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
        message: err.message || 'Internal Server Error',
        ...(isDev && { stack: err.stack }),
        ...(isDev && { path: req.originalUrl }),
    });
};

module.exports = errorMiddleware;
