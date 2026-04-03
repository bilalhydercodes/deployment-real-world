// middleware/requestLogger.js
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight HTTP request logger (Morgan-style, no extra dependency)
// Logs: METHOD  /path  STATUS  Xms
// Skips logging in test environment
// ─────────────────────────────────────────────────────────────────────────────

const requestLogger = (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();

    const start = Date.now();
    const { method, originalUrl } = req;

    // Hook into response finish event to capture status + duration
    res.on('finish', () => {
        const ms = Date.now() - start;
        const status = res.statusCode;

        // Color-code by status range
        let color = '\x1b[32m'; // green  2xx
        if (status >= 300 && status < 400) color = '\x1b[36m'; // cyan   3xx
        if (status >= 400 && status < 500) color = '\x1b[33m'; // yellow 4xx
        if (status >= 500) color = '\x1b[31m'; // red    5xx
        const reset = '\x1b[0m';

        console.log(`${color}${method.padEnd(7)}${reset} ${originalUrl.padEnd(40)} ${color}${status}${reset}  ${ms}ms`);
    });

    next();
};

module.exports = requestLogger;
