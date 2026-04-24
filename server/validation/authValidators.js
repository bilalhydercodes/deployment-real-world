const { isValidEmail, isValidPassword } = require('../utils/validators');

const required = (obj, field) => obj[field] !== undefined && obj[field] !== null && String(obj[field]).trim() !== '';

function registerValidator(body) {
    const errors = [];
    if (!required(body, 'name')) errors.push({ field: 'name', message: 'name is required' });
    if (!required(body, 'email')) errors.push({ field: 'email', message: 'email is required' });
    if (!required(body, 'password')) errors.push({ field: 'password', message: 'password is required' });
    if (required(body, 'email') && !isValidEmail(body.email)) errors.push({ field: 'email', message: 'email is invalid' });
    if (required(body, 'password') && !isValidPassword(body.password)) errors.push({ field: 'password', message: 'password does not meet complexity rules' });
    return { valid: errors.length === 0, errors };
}

function emailPasswordValidator(body) {
    const errors = [];
    if (!required(body, 'email')) errors.push({ field: 'email', message: 'email is required' });
    if (!required(body, 'password')) errors.push({ field: 'password', message: 'password is required' });
    if (required(body, 'email') && !isValidEmail(body.email)) errors.push({ field: 'email', message: 'email is invalid' });
    return { valid: errors.length === 0, errors };
}

function invitePasswordValidator(body) {
    const errors = [];
    if (!required(body, 'inviteCode')) errors.push({ field: 'inviteCode', message: 'inviteCode is required' });
    if (!required(body, 'password')) errors.push({ field: 'password', message: 'password is required' });
    return { valid: errors.length === 0, errors };
}

function refreshTokenValidator(body, req) {
    const token = body.refreshToken || req.headers['x-refresh-token'];
    const errors = [];
    if (!token) errors.push({ field: 'refreshToken', message: 'refreshToken is required (body or x-refresh-token)' });
    return { valid: errors.length === 0, errors };
}

function forgotRequestValidator(body) {
    const errors = [];
    if (!required(body, 'contact')) errors.push({ field: 'contact', message: 'contact is required' });
    return { valid: errors.length === 0, errors };
}

function forgotVerifyValidator(body) {
    const errors = [];
    if (!required(body, 'contact')) errors.push({ field: 'contact', message: 'contact is required' });
    if (!required(body, 'otp')) errors.push({ field: 'otp', message: 'otp is required' });
    return { valid: errors.length === 0, errors };
}

function forgotResetValidator(body) {
    const errors = [];
    if (!required(body, 'contact')) errors.push({ field: 'contact', message: 'contact is required' });
    if (!required(body, 'resetToken')) errors.push({ field: 'resetToken', message: 'resetToken is required' });
    if (!required(body, 'newPassword')) errors.push({ field: 'newPassword', message: 'newPassword is required' });
    if (required(body, 'newPassword') && !isValidPassword(body.newPassword)) errors.push({ field: 'newPassword', message: 'newPassword does not meet complexity rules' });
    return { valid: errors.length === 0, errors };
}

function adminPasswordUpdateValidator(body) {
    const errors = [];
    if (!required(body, 'newPassword')) errors.push({ field: 'newPassword', message: 'newPassword is required' });
    if (required(body, 'newPassword') && !isValidPassword(body.newPassword)) errors.push({ field: 'newPassword', message: 'newPassword does not meet complexity rules' });
    return { valid: errors.length === 0, errors };
}

module.exports = {
    registerValidator,
    emailPasswordValidator,
    invitePasswordValidator,
    refreshTokenValidator,
    forgotRequestValidator,
    forgotVerifyValidator,
    forgotResetValidator,
    adminPasswordUpdateValidator,
};
