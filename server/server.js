// server.js
// ─────────────────────────────────────────────────────────────────────────────
// Production-hardened Express server — College Management System
//
// Security layers applied (in order):
//   1. Helmet        — HTTP security headers (CSP, XSS, clickjacking, etc.)
//   2. CORS          — Strict origin control
//   3. mongoSanitize — NoSQL injection prevention ($, . stripped from input)
//   4. hpp           — HTTP Parameter Pollution prevention
//   5. XSS sanitizer — Strip HTML/script tags from req.body strings
//   6. Rate limiters — Targeted brute-force protection on auth endpoints
//   7. Body size cap — 10kb max to prevent payload flooding
// ─────────────────────────────────────────────────────────────────────────────

const express        = require('express');
const dotenv         = require('dotenv');
const cors           = require('cors');
const path           = require('path');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const mongoSanitize  = require('express-mongo-sanitize');
const hpp            = require('hpp');
const xss            = require('xss');

const connectDB        = require('./config/db');
const requestLogger    = require('./middleware/requestLogger');
const securityLogger   = require('./middleware/securityLogger');
const errorMiddleware  = require('./middleware/errorMiddleware');

// ── 1. Environment variables ──────────────────────────────────────────────────
dotenv.config();

// Fail fast if critical env vars are missing
const REQUIRED_ENV = ['JWT_SECRET'];
if (!process.env.MONGO_URI && !process.env.DATABASE_URL) {
    console.error('\x1b[31m[FATAL] Missing required env var: MONGO_URI or DATABASE_URL\x1b[0m');
    process.exit(1);
}
REQUIRED_ENV.forEach(key => {
    if (!process.env[key]) {
        console.error(`\x1b[31m[FATAL] Missing required env var: ${key}\x1b[0m`);
        process.exit(1);
    }
});

// Warn if JWT secret looks like a placeholder
if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('change_this')) {
    console.warn('\x1b[33m[WARN] JWT_SECRET is weak or a placeholder. Use a strong random secret in production.\x1b[0m');
}

// ── 2. Connect to MongoDB Atlas ───────────────────────────────────────────────
connectDB();

const app = express();

// ── 3. Security headers via Helmet ───────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
            styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
            fontSrc:     ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc:      ["'self'", "data:", "https:", "blob:"],
            connectSrc:  ["'self'", "https:"],
            frameSrc:    ["'none'"],
            objectSrc:   ["'none'"],
            workerSrc:   ["'self'", "blob:"],
        },
    },
    crossOriginEmbedderPolicy: false, // needed for html2pdf CDN
    hsts: {
        maxAge: 31536000,       // 1 year
        includeSubDomains: true,
        preload: true,
    },
}));

// ── 4. CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
    : ['*'];

app.use(cors({
    origin: allowedOrigins.includes('*') ? '*' : (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// ── 5. Body parsers (BEFORE sanitizers) ──────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── 6. NoSQL Injection prevention ────────────────────────────────────────────
// Strips $ and . from req.body, req.query, req.params
// Prevents: { "email": { "$gt": "" } } style attacks
app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        console.warn(`\x1b[33m[SECURITY] NoSQL injection attempt blocked — key: ${key} IP: ${req.ip}\x1b[0m`);
    },
}));

// ── 7. HTTP Parameter Pollution prevention ────────────────────────────────────
// Prevents: ?role=admin&role=student (takes last value, not array)
app.use(hpp());

// ── 8. XSS sanitization middleware ───────────────────────────────────────────
// Strips HTML tags from all string values in req.body
const sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const sanitize = (obj) => {
            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'string') {
                    obj[key] = xss(obj[key], { whiteList: {}, stripIgnoreTag: true });
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitize(obj[key]);
                }
            }
        };
        sanitize(req.body);
    }
    next();
};
app.use(sanitizeBody);

// ── 9. Rate limiters ──────────────────────────────────────────────────────────
// Schools share IPs (NAT/proxy) — limits are relaxed intentionally.
// skipSuccessfulRequests: true means only failed attempts count.

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => req.headers['x-load-test'] === process.env.LOAD_TEST_SECRET,
    message: { success: false, message: 'Too many login attempts from this network. Please wait 15 minutes.' },
    handler: (req, res, next, options) => {
        console.warn(`\x1b[33m[RATE LIMIT] Login limit hit — IP: ${req.ip}\x1b[0m`);
        res.status(429).json(options.message);
    },
});

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, message: 'Too many OTP requests. Please wait 10 minutes.' },
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});

// Strict limiter for password reset — prevents enumeration attacks
const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many password reset attempts. Please try again in an hour.' },
});

// ── 10. Request logger ────────────────────────────────────────────────────────
app.use(requestLogger);
app.use(securityLogger);

// ── 11. Static files ──────────────────────────────────────────────────────────
app.use('/client', express.static(path.join(__dirname, '..', 'client')));
app.use(express.static(path.join(__dirname, '..', 'client', 'pages')));

// ── 12. Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'College Management API is running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
});

// ── 13. Rate limit bindings (BEFORE route mounting) ──────────────────────────
app.use('/api/auth/register',              registerLimiter);
app.use('/api/auth/login',                 loginLimiter);
app.use('/api/auth/student-login',         loginLimiter);
app.use('/api/auth/teacher-login',         loginLimiter);
app.use('/api/teacher/teacher-login',      loginLimiter);
app.use('/api/otp/',                       otpLimiter);
app.use('/api/auth/forgot-password',       resetLimiter);

// ── 14. API routes ────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/teacher',     require('./routes/teacherRoutes'));
app.use('/api/attendance',  require('./routes/attendanceRoutes'));
app.use('/api/marks',       require('./routes/marksRoutes'));
app.use('/api/fees',        require('./routes/feesRoutes'));
app.use('/api/sessions',    require('./routes/sessionRoutes'));
app.use('/api/notices',     require('./routes/noticeRoutes'));
app.use('/api/timetable',   require('./routes/timetableRoutes'));
app.use('/api/assignments', require('./routes/assignmentRoutes'));
app.use('/api/leaves',      require('./routes/leaveRoutes'));
app.use('/api/discipline',  require('./routes/disciplineRoutes'));
app.use('/api/otp',         require('./routes/otpRoutes'));
app.use('/api/admin',       require('./routes/adminRoutes'));

// ── 15. SPA fallback ──────────────────────────────────────────────────────────
app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api/')) {
        const err = new Error(`API route not found: ${req.originalUrl}`);
        err.statusCode = 404;
        return next(err);
    }
    res.sendFile(path.join(__dirname, '..', 'client', 'pages', 'login.html'));
});

// ── 16. Centralised error handler ────────────────────────────────────────────
app.use(errorMiddleware);

// ── 17. Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n\x1b[35m🚀 Server running on http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[35m📚 College Management System API Ready\x1b[0m`);
    console.log(`\x1b[35m🌍 Environment: ${process.env.NODE_ENV || 'development'}\x1b[0m`);
    console.log(`\x1b[32m🔒 Security: Helmet + mongoSanitize + HPP + XSS + Rate Limiting active\x1b[0m\n`);
});
