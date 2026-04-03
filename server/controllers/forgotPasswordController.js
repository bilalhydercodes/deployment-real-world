// Forgot Password Controller
// Flow: request OTP → verify OTP → reset password
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const nodemailer = require('nodemailer');
const { isValidPassword } = require('../utils/validators');

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function createTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return null;
}

async function sendOTPEmail(email, otp) {
    const transporter = createTransporter();
    if (!transporter) {
        console.log(`[FORGOT-PWD OTP] ${email} → ${otp}`);
        return false;
    }
    try {
        await transporter.sendMail({
            from: `"College Management" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset OTP - College Management System',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                    <h2 style="color:#4F46E5;">Password Reset Request</h2>
                    <p>You requested to reset your password. Use the OTP below:</p>
                    <div style="background:#F3F4F6;padding:24px;text-align:center;font-size:36px;
                        font-weight:bold;letter-spacing:10px;color:#1F2937;border-radius:10px;margin:20px 0;">
                        ${otp}
                    </div>
                    <p style="color:#6B7280;">Valid for <strong>5 minutes</strong>. Do not share this code.</p>
                    <p style="color:#9CA3AF;font-size:12px;">If you didn't request this, ignore this email.</p>
                </div>`,
            text: `Your password reset OTP is: ${otp}. Valid for 5 minutes.`,
        });
        console.log(`[FORGOT-PWD OTP] Email sent to ${email}`);
        return true;
    } catch (err) {
        console.error(`[FORGOT-PWD OTP] Email failed:`, err.message);
        return false;
    }
}

// ── Step 1: Request OTP ───────────────────────────────────────────────────────
/**
 * @route  POST /api/auth/forgot-password/request
 * @access Public
 * @body   { contact: "email or phone" }
 *
 * Security: always returns 200 regardless of whether user exists (prevents enumeration)
 */
const requestPasswordReset = async (req, res, next) => {
    try {
        const { contact } = req.body;
        if (!contact) {
            return res.status(400).json({ success: false, message: 'Email or phone is required' });
        }

        const normalised = contact.trim().toLowerCase();

        // Look up user — but don't reveal if they exist
        const user = await User.findOne({
            $or: [{ email: normalised }, { mobile: normalised }],
        });

        // Always respond the same way (prevent user enumeration)
        const genericMsg = 'If an account exists, an OTP has been sent.';

        if (!user) {
            // Still return 200 — don't leak user existence
            return res.json({ success: true, message: genericMsg });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

        // Upsert OTP — one active OTP per contact at a time
        await OTP.findOneAndUpdate(
            { contact: normalised },
            { otp, expiresAt, verified: false },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Send email if contact is an email
        const isEmail = normalised.includes('@');
        let sent = false;
        if (isEmail) sent = await sendOTPEmail(normalised, otp);

        // Always log in dev
        if (process.env.NODE_ENV !== 'production' || !sent) {
            console.log(`[FORGOT-PWD OTP] ${normalised} → ${otp}`);
        }

        return res.json({
            success: true,
            message: genericMsg,
            ...(process.env.NODE_ENV !== 'production' && { otp }), // dev only
        });
    } catch (err) {
        next(err);
    }
};

// ── Step 2: Verify OTP ────────────────────────────────────────────────────────
/**
 * @route  POST /api/auth/forgot-password/verify-otp
 * @access Public
 * @body   { contact, otp }
 *
 * Returns a short-lived reset token on success (used in step 3)
 */
const verifyResetOTP = async (req, res, next) => {
    try {
        const { contact, otp } = req.body;
        if (!contact || !otp) {
            return res.status(400).json({ success: false, message: 'contact and otp are required' });
        }

        const normalised = contact.trim().toLowerCase();
        const record = await OTP.findOne({ contact: normalised });

        if (!record || record.otp !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
        }

        // OTP is valid — delete it (one-time use)
        await OTP.deleteOne({ _id: record._id });

        // Issue a short-lived reset token (signed, not stored — stateless)
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Store hashed token in DB with 10-min expiry
        const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');
        await OTP.create({
            contact: `reset:${normalised}`,
            otp: hashed,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min to complete reset
        });

        return res.json({
            success: true,
            message: 'OTP verified. Proceed to reset your password.',
            resetToken, // send raw token to client; store hashed in DB
        });
    } catch (err) {
        next(err);
    }
};

// ── Step 3: Reset Password ────────────────────────────────────────────────────
/**
 * @route  POST /api/auth/forgot-password/reset
 * @access Public
 * @body   { contact, resetToken, newPassword }
 */
const resetPassword = async (req, res, next) => {
    try {
        const { contact, resetToken, newPassword } = req.body;

        if (!contact || !resetToken || !newPassword) {
            return res.status(400).json({ success: false, message: 'contact, resetToken and newPassword are required' });
        }
        if (!isValidPassword(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const normalised = contact.trim().toLowerCase();
        const hashed = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Validate reset token
        const record = await OTP.findOne({ contact: `reset:${normalised}`, otp: hashed });
        if (!record) {
            return res.status(400).json({ success: false, message: 'Reset token is invalid or has expired.' });
        }

        // Find user
        const user = await User.findOne({
            $or: [{ email: normalised }, { mobile: normalised }],
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Update password (pre-save hook will hash it)
        user.password = newPassword;
        await user.save();

        // Invalidate the reset token
        await OTP.deleteOne({ _id: record._id });

        console.log(`[FORGOT-PWD] Password reset for user: ${user.email || user.mobile} (${user.role})`);

        return res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        next(err);
    }
};

// ── Admin: Reset any user's password ─────────────────────────────────────────
/**
 * @route  PATCH /api/admin/update-password/:userId
 * @access Private (Admin only)
 * @body   { newPassword }
 */
const adminUpdatePassword = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!isValidPassword(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        target.password = newPassword;
        await target.save();

        // Security audit log
        console.log(`[ADMIN-PWD-RESET] Admin ${req.user.email} (${req.user._id}) reset password for ${target.email || target.inviteCode} (${target.role}) at ${new Date().toISOString()}`);

        return res.json({
            success: true,
            message: `Password updated for ${target.name} (${target.role})`,
            data: { _id: target._id, name: target.name, role: target.role },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { requestPasswordReset, verifyResetOTP, resetPassword, adminUpdatePassword };
