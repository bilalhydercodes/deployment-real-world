// Auth middleware — verifies JWT and re-validates user from DB on every request
// This prevents:
//   - Deleted users from using old tokens
//   - Locked accounts from continuing sessions
//   - Role-escalation via tampered tokens (role re-read from DB, not token)
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // 1. Verify signature and expiry
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 2. Re-fetch user from DB — catches deleted/locked accounts
            //    Role is read from DB, NOT from token (prevents role tampering)
            const user = await User.findById(decoded.id)
                .select('-password -loginAttempts -lockUntil')
                .lean();

            if (!user) {
                return res.status(401).json({ success: false, message: 'Account no longer exists. Please log in again.' });
            }

            // 3. Block locked student accounts
            if (user.isLocked) {
                return res.status(403).json({ success: false, message: 'Your account is locked. Please contact the admin.' });
            }

            // 4. Block accounts with active brute-force lock
            if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
                const mins = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
                return res.status(429).json({ success: false, message: `Account locked. Try again in ${mins} minute(s).` });
            }

            req.user = user;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
            }
            return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
        }
    } else {
        return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
    }
};

module.exports = { protect };
