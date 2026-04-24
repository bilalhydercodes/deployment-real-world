const { getPermissionsForRole } = require('../config/permissions');

const requirePermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Not authenticated' });
        }

        const granted = new Set(getPermissionsForRole(req.user.role));
        const missing = permissions.filter((p) => !granted.has(p));

        if (missing.length > 0) {
            return res.status(403).json({
                success: false,
                code: 'INSUFFICIENT_PERMISSIONS',
                message: 'Access denied for this operation.',
                details: { missingPermissions: missing },
            });
        }

        next();
    };
};

module.exports = { requirePermission };
