// OTP model - stores OTPs in MongoDB with automatic TTL expiry
// MongoDB TTL index auto-deletes documents after 'expiresAt'
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    contact: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    otp: {
        type: String,
        required: true,
    },
    // TTL index: MongoDB auto-deletes this document after expiresAt
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
    verified: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

// TTL index — MongoDB removes the document automatically after expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookup by contact
otpSchema.index({ contact: 1 });

module.exports = mongoose.model('OTP', otpSchema);

