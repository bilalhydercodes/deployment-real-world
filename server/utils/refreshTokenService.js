const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const logger = require('./logger');

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function buildExpiryDate() {
    const days = Math.max(1, parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function issueRefreshToken({ userId, family, ip, userAgent, device }) {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);

    const doc = await RefreshToken.create({
        user: userId,
        tokenHash,
        family: family || crypto.randomUUID(),
        expiresAt: buildExpiryDate(),
        createdByIp: ip,
        userAgent,
        device,
    });

    return { rawToken, doc };
}

async function revokeTokenFamily(family, reason = 'unknown') {
    if (!family) return;
    await RefreshToken.updateMany(
        { family, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
    logger.warn('refresh_token_family_revoked', { family, reason });
}

async function rotateRefreshToken({ rawToken, ip, userAgent, device }) {
    const currentHash = hashToken(rawToken);
    const now = new Date();

    // Atomic consume: a refresh token can only be rotated once.
    const current = await RefreshToken.findOneAndUpdate(
        { tokenHash: currentHash, revokedAt: null, expiresAt: { $gt: now } },
        { $set: { revokedAt: now } },
        { new: true }
    ).populate('user');

    if (!current) {
        const existing = await RefreshToken.findOne({ tokenHash: currentHash });
        if (!existing) return { error: 'Invalid refresh token' };
        if (existing.expiresAt <= now) return { error: 'Refresh token has expired' };

        // Reuse-detection: revoked token seen again means possible theft/replay.
        if (existing.revokedAt) {
            await revokeTokenFamily(existing.family, 'refresh-token-reuse-detected');
            return { error: 'Refresh token reuse detected. Please log in again.' };
        }

        return { error: 'Refresh token is invalid' };
    }

    if (!current.user) {
        await revokeTokenFamily(current.family, 'user-missing-during-rotation');
        return { error: 'User no longer exists' };
    }

    const replacement = await issueRefreshToken({
        userId: current.user._id,
        family: current.family,
        ip,
        userAgent,
        device,
    });

    await RefreshToken.findByIdAndUpdate(current._id, {
        $set: { replacedByTokenHash: replacement.doc.tokenHash },
    });

    return { current, replacement };
}



async function listActiveSessions(userId) {
    const now = new Date();
    return RefreshToken.find({
        user: userId,
        revokedAt: null,
        expiresAt: { $gt: now },
    })
        .sort({ createdAt: -1 })
        .select('createdAt expiresAt createdByIp userAgent device family');
}

async function revokeAllSessionsExceptCurrent(userId, currentRawToken) {
    const currentHash = hashToken(currentRawToken);
    const now = new Date();
    const result = await RefreshToken.updateMany(
        {
            user: userId,
            tokenHash: { $ne: currentHash },
            revokedAt: null,
            expiresAt: { $gt: now },
        },
        { $set: { revokedAt: now } }
    );
    return result.modifiedCount || 0;
}

async function revokeRefreshToken(rawToken, options = {}) {
    const tokenHash = hashToken(rawToken);
    const doc = await RefreshToken.findOne({ tokenHash });
    if (!doc) return false;

    if (!doc.revokedAt) {
        doc.revokedAt = new Date();
        await doc.save();
    }

    if (options.revokeFamily) {
        await revokeTokenFamily(doc.family, options.reason || 'logout-family-revoke');
    }

    return true;
}

module.exports = {
    hashToken,
    issueRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    revokeTokenFamily,
    listActiveSessions,
    revokeAllSessionsExceptCurrent,
};
