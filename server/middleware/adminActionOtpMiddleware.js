const AdminActionOTP = require('../models/AdminActionOTP');
const { hashValue } = require('../utils/hashValue');

function requireAdminActionOTP(action) {
    return async (req, res, next) => {
        try {
            const verificationToken = req.headers['x-admin-otp-token'];
            if (!verificationToken) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin OTP verification required. Provide x-admin-otp-token header.',
                });
            }

            // Atomic consume to prevent concurrent token reuse.
            const record = await AdminActionOTP.findOneAndUpdate(
                {
                    adminId: req.user._id,
                    action,
                    verifiedTokenHash: hashValue(String(verificationToken)),
                    verifiedUntil: { $gt: new Date() },
                },
                { $set: { verifiedTokenHash: null, verifiedUntil: null } },
                { new: true }
            );

            if (!record) {
                return res.status(403).json({ success: false, message: 'Admin OTP token is invalid or expired.' });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = { requireAdminActionOTP };
