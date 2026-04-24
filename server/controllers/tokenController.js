const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const {
    issueRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    listActiveSessions,
    revokeAllSessionsExceptCurrent,
} = require('../utils/refreshTokenService');
const logger = require('../utils/logger');
const apiResponse = require('../utils/apiResponse');

const buildAuthPayload = (user, refreshToken) => {
    const accessToken = generateToken(user._id, user.role);
    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        inviteCode: user.inviteCode,
        token: accessToken,
        refreshToken,
    };
};

function detectDevice(req) {
    return String(req.headers['x-device-name'] || req.headers['x-device-id'] || req.get('user-agent') || 'Unknown Device').slice(0, 180);
}

const createSessionTokens = async ({ user, req }) => {
    const { rawToken } = await issueRefreshToken({
        userId: user._id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        device: detectDevice(req),
    });

    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date(), lastActivity: new Date() } });

    return buildAuthPayload(user, rawToken);
};

const getSessions = async (req, res, next) => {
    try {
        const sessions = await listActiveSessions(req.user._id);
        return apiResponse.success(res, { code: 'SESSIONS_LISTED', message: 'Active sessions fetched', data: sessions });
    } catch (error) {
        logger.error('list_sessions_failed', { error: error.message, userId: String(req.user?._id) });
        next(error);
    }
};

const refreshAccessToken = async (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
        if (!refreshToken) return apiResponse.failure(res, { status: 400, code: 'MISSING_REFRESH_TOKEN', message: 'refreshToken is required' });

        const rotated = await rotateRefreshToken({
            rawToken: String(refreshToken),
            ip: req.ip,
            userAgent: req.get('user-agent'),
            device: detectDevice(req),
        });

        if (rotated.error) {
            return apiResponse.failure(res, { status: 401, code: 'REFRESH_FAILED', message: rotated.error });
        }

        await User.updateOne({ _id: rotated.current.user._id }, { $set: { lastActivity: new Date() } });

        const payload = buildAuthPayload(rotated.current.user, rotated.replacement.rawToken);
        return apiResponse.success(res, { code: 'TOKEN_ROTATED', message: 'Token rotated successfully', data: payload });
    } catch (error) {
        logger.error('refresh_token_rotation_failed', { error: error.message, ip: req.ip });
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
        if (!refreshToken) return apiResponse.failure(res, { status: 400, code: 'MISSING_REFRESH_TOKEN', message: 'refreshToken is required' });

        const revokeFamily = Boolean(req.body.revokeFamily);
        await revokeRefreshToken(String(refreshToken), {
            revokeFamily,
            reason: revokeFamily ? 'logout-family-revoke' : 'logout-single-token',
        });

        return apiResponse.success(res, { code: revokeFamily ? 'LOGOUT_ALL' : 'LOGOUT_SUCCESS', message: revokeFamily ? 'Logged out from all devices' : 'Logged out successfully' });
    } catch (error) {
        logger.error('logout_failed', { error: error.message, ip: req.ip });
        next(error);
    }
};

const logoutAllExceptCurrent = async (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
        if (!refreshToken) return apiResponse.failure(res, { status: 400, code: 'MISSING_REFRESH_TOKEN', message: 'refreshToken is required' });

        const revokedCount = await revokeAllSessionsExceptCurrent(req.user._id, String(refreshToken));
        return apiResponse.success(res, { code: 'LOGOUT_ALL_EXCEPT_CURRENT', message: 'Other sessions revoked successfully', data: { revokedCount } });
    } catch (error) {
        logger.error('logout_all_except_current_failed', { error: error.message, userId: String(req.user?._id) });
        next(error);
    }
};

module.exports = {
    createSessionTokens,
    getSessions,
    refreshAccessToken,
    logout,
    logoutAllExceptCurrent,
};
