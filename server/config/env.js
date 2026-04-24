const NODE_ENV = process.env.NODE_ENV || 'development';

const config = {
    env: NODE_ENV,
    isProduction: NODE_ENV === 'production',
    appVersion: process.env.APP_VERSION || '1.0.0',
    bodyLimit: process.env.BODY_LIMIT || '10kb',
    clientOrigins: process.env.CLIENT_ORIGIN
        ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
        : ['*'],
    logLevel: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'warn' : 'debug'),
};

process.env.LOG_LEVEL = config.logLevel;

module.exports = config;
