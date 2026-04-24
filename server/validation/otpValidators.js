const required = (obj, field) => obj[field] !== undefined && obj[field] !== null && String(obj[field]).trim() !== '';

function sendOtpValidator(body) {
    const errors = [];
    if (!required(body, 'contact')) errors.push({ field: 'contact', message: 'contact is required' });
    return { valid: errors.length === 0, errors };
}

function verifyOtpValidator(body) {
    const errors = [];
    if (!required(body, 'contact')) errors.push({ field: 'contact', message: 'contact is required' });
    if (!required(body, 'otp')) errors.push({ field: 'otp', message: 'otp is required' });
    return { valid: errors.length === 0, errors };
}

function adminOtpRequestValidator(body) {
    const errors = [];
    if (!required(body, 'action')) errors.push({ field: 'action', message: 'action is required' });
    return { valid: errors.length === 0, errors };
}

function adminOtpVerifyValidator(body) {
    const errors = [];
    if (!required(body, 'action')) errors.push({ field: 'action', message: 'action is required' });
    if (!required(body, 'otp')) errors.push({ field: 'otp', message: 'otp is required' });
    return { valid: errors.length === 0, errors };
}

module.exports = {
    sendOtpValidator,
    verifyOtpValidator,
    adminOtpRequestValidator,
    adminOtpVerifyValidator,
};
