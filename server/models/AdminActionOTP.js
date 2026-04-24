const mongoose = require('mongoose');

const adminActionOTPSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    verifiedTokenHash: { type: String, default: null, index: true },
    verifiedUntil: { type: Date, default: null, index: true },
}, { timestamps: true });

adminActionOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminActionOTPSchema.index({ adminId: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('AdminActionOTP', adminActionOTPSchema);
