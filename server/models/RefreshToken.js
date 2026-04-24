const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    createdByIp: { type: String },
    userAgent: { type: String },
    device: { type: String, default: 'Unknown Device' },
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, family: 1 });
refreshTokenSchema.index({ user: 1, revokedAt: 1, expiresAt: -1 });
refreshTokenSchema.index({ user: 1, tokenHash: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
