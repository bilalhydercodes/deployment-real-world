const crypto = require('crypto');
const nodemailer = require('nodemailer');
const AdminActionOTP = require('../models/AdminActionOTP');
const { hashValue } = require('../utils/hashValue');
const logger = require('../utils/logger');

const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SEC = Math.max(15, parseInt(process.env.OTP_RESEND_COOLDOWN_SEC || '60', 10));
const ALLOWED_ACTIONS = new Set([
    'update-password',
    'set-password',
    'lock-student',
    'create-student',
    'create-teacher',
    'update-teacher',
    'delete-teacher',
    'bulk-create-student',
]);

function createTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return null;
}

function normalizeAction(action) {
    return String(action || '').trim().toLowerCase();
}

function generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailOTP(email, otp, action) {
    const transporter = createTransporter();
    if (!transporter) {
        logger.warn('admin_otp_email_unavailable', { email, action });
        return false;
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Admin Action Verification OTP',
            html: `<p>OTP for admin action <b>${action}</b>: <b style="font-size:22px">${otp}</b></p><p>Valid for 5 minutes.</p>`,
            text: `OTP for admin action ${action}: ${otp}. Valid for 5 minutes.`,
        });
        return true;
    } catch (error) {
        logger.error('admin_otp_email_send_failed', { error: error.message, email, action });
        return false;
    }
}

const requestAdminActionOTP = async (req, res, next) => {
    try {
        const action = normalizeAction(req.body.action);
        if (!action) return res.status(400).json({ success: false, message: 'action is required' });
        if (!ALLOWED_ACTIONS.has(action)) {
            return res.status(400).json({ success: false, message: 'Unsupported admin action for OTP verification.' });
        }
        if (!req.user.email) return res.status(400).json({ success: false, message: 'Admin account must have an email for OTP verification.' });

        const existing = await AdminActionOTP.findOne({ adminId: req.user._id, action });
        if (existing && existing.updatedAt) {
            const secondsSinceLast = Math.floor((Date.now() - new Date(existing.updatedAt).getTime()) / 1000);
            if (secondsSinceLast < OTP_RESEND_COOLDOWN_SEC) {
                const retryAfterSeconds = OTP_RESEND_COOLDOWN_SEC - secondsSinceLast;
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${retryAfterSeconds}s before requesting another OTP.`,
                    retryAfterSeconds,
                });
            }
        }

        const otp = generateOtpCode();
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);

        await AdminActionOTP.findOneAndUpdate(
            { adminId: req.user._id, action },
            {
                otpHash: hashValue(otp),
                expiresAt,
                attempts: 0,
                verifiedTokenHash: null,
                verifiedUntil: null,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const sent = await sendEmailOTP(req.user.email, otp, action);
        if (!sent || process.env.NODE_ENV !== 'production') {
            logger.info('admin_otp_generated', { adminId: String(req.user._id), action, delivery: sent ? 'email' : 'log-only' });
        }

        return res.json({
            success: true,
            message: sent ? 'OTP sent to admin email.' : 'OTP generated. Check server logs in development.',
            ...(process.env.NODE_ENV !== 'production' && { otp }),
        });
    } catch (error) {
        next(error);
    }
};

const verifyAdminActionOTP = async (req, res, next) => {
    try {
        const action = normalizeAction(req.body.action);
        const otp = req.body.otp;

        if (!action || !otp) {
            return res.status(400).json({ success: false, message: 'action and otp are required' });
        }
        if (!ALLOWED_ACTIONS.has(action)) {
            return res.status(400).json({ success: false, message: 'Unsupported admin action for OTP verification.' });
        }

        const record = await AdminActionOTP.findOne({ adminId: req.user._id, action });
        if (!record || record.expiresAt <= new Date()) {
            return res.status(400).json({ success: false, message: 'OTP expired or not requested' });
        }
        if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
            logger.warn('admin_otp_attempt_limit_hit', { adminId: String(req.user._id), action });
            return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
        }

        const otpMatch = record.otpHash === hashValue(String(otp).trim());
        if (!otpMatch) {
            record.attempts += 1;
            await record.save();
            logger.warn('admin_otp_invalid', { adminId: String(req.user._id), action, attempts: record.attempts });
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        record.verifiedTokenHash = hashValue(verificationToken);
        record.verifiedUntil = new Date(Date.now() + VERIFIED_TTL_MS);
        record.attempts = 0;

        // Consume OTP itself to prevent OTP replay; only verificationToken remains usable.
        record.otpHash = hashValue(crypto.randomBytes(16).toString('hex'));
        record.expiresAt = new Date();

        await record.save();

        return res.json({
            success: true,
            message: 'Admin action OTP verified',
            data: { verificationToken, expiresAt: record.verifiedUntil },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    requestAdminActionOTP,
    verifyAdminActionOTP,
    ALLOWED_ACTIONS,
};
