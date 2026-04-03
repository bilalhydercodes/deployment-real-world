// Input validation helpers
/**
 * Validate email format
 */
const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

/**
 * Validate password strength
 * Min 8 chars, at least one uppercase, one number, one special char
 */
const isValidPassword = (password) => {
    if (!password || password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
    return true;
};

const passwordRules = 'Password must be at least 8 characters with one uppercase letter, one number, and one special character (!@#$%^&* etc.)';

/**
 * Validate that marks are within range
 */
const isValidMarks = (marks, total = 100) => {
    return marks >= 0 && marks <= total;
};

/**
 * Validate role is one of allowed roles
 */
const isValidRole = (role) => {
    return ['admin', 'teacher', 'student'].includes(role);
};

module.exports = { isValidEmail, isValidPassword, isValidMarks, isValidRole, passwordRules };
