// Role-based access control middleware
/**
 * Restrict route access to specific roles
 * @param {...string} roles - Allowed roles (admin, teacher, student)
 *
 * NOTE: Role comparison is case-insensitive.
 * Stored roles like 'Admin', 'Teacher', 'Student' all match their lowercase equivalents.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Normalize the role to lowercase so 'Admin', 'admin', 'ADMIN' all match
        const userRole = String(req.user.role || '').toLowerCase().trim();

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Role '${userRole}' is not authorized for this action.`,
            });
        }

        next();
    };
};

module.exports = { authorize };

