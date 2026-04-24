const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const configuredLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function shouldLog(level) {
    return (LEVELS[level] ?? LEVELS.info) <= threshold;
}

function log(level, message, meta = {}) {
    if (!shouldLog(level)) return;

    const payload = {
        level,
        message,
        timestamp: new Date().toISOString(),
        service: process.env.SERVICE_NAME || 'college-management-api',
        environment: process.env.NODE_ENV || 'development',
        ...meta,
    };

    const line = JSON.stringify(payload);
    if (level === 'error') return console.error(line);
    if (level === 'warn') return console.warn(line);
    return console.log(line);
}

module.exports = {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    debug: (message, meta) => log('debug', message, meta),
};
