// OTP Controller — DB-backed OTP with MongoDB TTL auto-expiry
// OTPs are stored in MongoDB Atlas; the TTL index on 'expiresAt' auto-deletes
// expired documents — no cron job or manual cleanup needed.
const OTP = require('../models/OTP');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const OTP_RESEND_COOLDOWN_SEC = Math.max(15, parseInt(process.env.OTP_RESEND_COOLDOWN_SEC || '60', 10));

/** Generate a cryptographically random 6-digit OTP */
function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/** Create email transporter */
function createTransporter() {
    // Check if SMTP credentials are configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return null;
}

/** Send OTP via email */
async function sendOTPEmail(email, otp) {
    const transporter = createTransporter();
    
    if (!transporter) {
        logger.warn('otp_email_not_configured', { email });
        return false;
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Your OTP Code - College Management System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">College Management System</h2>
                    <p>Your One-Time Password (OTP) for verification is:</p>
                    <div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1F2937; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="color: #6B7280;">This OTP is valid for 5 minutes.</p>
                    <p style="color: #6B7280; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
                </div>
            `,
            text: `Your OTP code is: ${otp}. Valid for 5 minutes.`,
        });
        logger.info('otp_email_sent', { email });
        return true;
    } catch (error) {
        logger.error('otp_email_send_failed', { email, error: error.message });
        return false;
    }
}

/**
 * @desc    Send OTP to parent phone/email
 * @route   POST /api/otp/send-otp
 * @access  Public
 * Body: { contact: "phone_or_email" }
 *
 * Production: swap the console.log for Twilio SMS or Nodemailer email.
 */
const sendOTP = async (req, res, next) => {
    try {
        const { contact } = req.body;
        if (!contact) {
            return res.status(400).json({ success: false, message: 'contact (phone or email) is required' });
        }

        const normalised = contact.trim().toLowerCase();
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        const existing = await OTP.findOne({ contact: normalised });
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

        // Upsert: replace any existing OTP for this contact (prevents duplicates)
        await OTP.findOneAndUpdate(
            { contact: normalised },
            { otp, expiresAt, verified: false },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Send OTP via email if it looks like an email address
        const isEmail = normalised.includes('@');
        let emailSent = false;
        
        if (isEmail) {
            emailSent = await sendOTPEmail(normalised, otp);
        }

        // Log OTP to console in development or if email fails
        if (process.env.NODE_ENV !== 'production' || !emailSent) {
            logger.info('otp_generated', { contact: normalised, delivery: emailSent ? 'email' : 'log-only' });
        }

        res.json({
            success: true,
            message: emailSent 
                ? 'OTP sent to your email. Valid for 5 minutes.' 
                : 'OTP generated. Check console in development mode.',
            // Expose OTP only in dev/test — never in production
            ...(process.env.NODE_ENV !== 'production' && { otp }),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/otp/verify-otp
 * @access  Public
 * Body: { contact: "phone_or_email", otp: "123456" }
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { contact, otp } = req.body;
        if (!contact || !otp) {
            return res.status(400).json({ success: false, message: 'contact and otp are required' });
        }

        const normalised = contact.trim().toLowerCase();

        // Find the OTP record (expired docs are auto-deleted by TTL index)
        const record = await OTP.findOne({ contact: normalised });

        if (!record) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found or has expired. Please request a new one.',
            });
        }

        if (record.otp !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }

        // One-time use — delete after successful verification
        await OTP.deleteOne({ _id: record._id });

        res.json({ success: true, message: 'OTP verified successfully.' });
    } catch (error) {
        next(error);
    }
};

module.exports = { sendOTP, verifyOTP };
