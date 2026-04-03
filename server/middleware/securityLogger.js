// securityLogger.js
// Logs suspicious patterns: repeated 401/403s, unusual payloads, etc.
// In production, pipe these to a log aggregator (Datadog, Logtail, etc.)

const SUSPICIOUS_THRESHOLD = 5; // consecutive 4xx from same IP within window
const ipFailMap = new Map();     // ip -> { count, firstSeen }
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const securityLogger = (req, res, next) => {
    res.on('finish', () => {
        const { statusCode } = res;
        const ip = req.ip || req.connection.remoteAddress;
        const path = req.originalUrl;
        const method = req.method;

        // Track 401/403 failures per IP
        if (statusCode === 401 || statusCode === 403) {
            const now = Date.now();
            const entry = ipFailMap.get(ip) || { count: 0, firstSeen: now };

            // Reset window if expired
            if (now - entry.firstSeen > WINDOW_MS) {
                entry.count = 0;
                entry.firstSeen = now;
            }

            entry.count++;
            ipFailMap.set(ip, entry);

            if (entry.count >= SUSPICIOUS_THRESHOLD) {
                console.warn(
                    `\x1b[31m[SECURITY ALERT] ${entry.count} auth failures from IP: ${ip} ` +
                    `on ${method} ${path} in ${Math.round((now - entry.firstSeen) / 1000)}s\x1b[0m`
                );
            }
        } else if (statusCode < 400) {
            // Clear on success
            ipFailMap.delete(ip);
        }

        // Log all admin-sensitive operations
        if (req.user && req.user.role === 'admin' && method !== 'GET') {
            console.log(
                `\x1b[36m[ADMIN ACTION] ${req.user.name || req.user._id} — ` +
                `${method} ${path} → ${statusCode}\x1b[0m`
            );
        }
    });

    next();
};

// Cleanup old entries every 10 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipFailMap.entries()) {
        if (now - entry.firstSeen > WINDOW_MS * 2) {
            ipFailMap.delete(ip);
        }
    }
}, 10 * 60 * 1000);

module.exports = securityLogger;
