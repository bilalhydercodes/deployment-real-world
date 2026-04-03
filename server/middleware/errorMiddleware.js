// middleware/errorMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Central production-level error handler
//
// Catches and normalises every error thrown via next(err):
//   • Mongoose CastError       → 400  (invalid ObjectId / field type)
//   • Mongoose ValidationError → 400  (schema rule violations)
//   • MongoDB duplicate key    → 400  (code 11000)
//   • JWT JsonWebTokenError    → 401  (malformed token)
//   • JWT TokenExpiredError    → 401  (expired token)
//   • Custom statusCode        → uses attached status
//   • Anything else            → 500  Internal Server Error
//
// Stack trace is only exposed in development mode.
// ─────────────────────────────────────────────────────────────────────────────

const errorMiddleware = (err, req, res, next) => {
    // ── Log to console (server side) ─────────────────────────────────────────
    const isDev = process.env.NODE_ENV === 'development';
    console.error(`\x1b[31m[ERROR] ${req.method} ${req.originalUrl} — ${err.message}\x1b[0m`);
    if (isDev) console.error(err.stack);

    // ── 1. Mongoose CastError — e.g. invalid MongoDB ObjectId ─────────────────
    //    Triggered when route param is not a valid ObjectId: GET /api/marks/abc
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: `Invalid value for field '${err.path}': ${err.value}`,
        });
    }

    // ── 2. Mongoose ValidationError — schema rule violations ──────────────────
    //    E.g. required field missing, enum mismatch, min/max breach
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: messages.join('. '),
        });
    }

    // ── 3. MongoDB duplicate key (unique index violation) ─────────────────────
    //    E.g. registering with an already-used email
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(400).json({
            success: false,
            message: `'${err.keyValue?.[field]}' is already registered for ${field}. Please use a different value.`,
        });
    }

    // ── 4. JWT — malformed / tampered token ───────────────────────────────────
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token. Please log in again.',
        });
    }

    // ── 5. JWT — expired token ─────────────────────────────────────────────────
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Your session has expired. Please log in again.',
        });
    }

    // ── 6. Custom app errors (thrown with err.statusCode) ─────────────────────
    //    E.g. const err = new Error('Not found'); err.statusCode = 404;
    const statusCode = err.statusCode && err.statusCode >= 100
        ? err.statusCode
        : 500;

    // ── 7. Generic fallback ────────────────────────────────────────────────────
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(isDev && { stack: err.stack }),         // Only in dev!
        ...(isDev && { path: req.originalUrl }),
    });
};

module.exports = errorMiddleware;
