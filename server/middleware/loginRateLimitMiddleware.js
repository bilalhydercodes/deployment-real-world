const rateLimit = require('express-rate-limit');

const loginIdentifierLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const identifier = String(req.body?.email || req.body?.inviteCode || '').toLowerCase().trim();
        return `${req.ip}:${identifier || 'unknown'}`;
    },
    message: {
        success: false,
        code: 'LOGIN_RATE_LIMITED',
        message: 'Too many failed login attempts for this account. Please wait 15 minutes.',
    },
});

module.exports = { loginIdentifierLimiter };
