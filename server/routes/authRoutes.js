// Auth routes
const express = require('express');
const router = express.Router();
const {
    register, login, teacherLogin, studentLogin, getMe,
    getAllStudents, updateProfile, adminSetUserPassword, lockUnlockStudent,
} = require('../controllers/authController');
const {
    requestPasswordReset, verifyResetOTP, resetPassword,
} = require('../controllers/forgotPasswordController');
const { refreshAccessToken, logout, getSessions, logoutAllExceptCurrent } = require('../controllers/tokenController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdminActionOTP } = require('../middleware/adminActionOtpMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { loginIdentifierLimiter } = require('../middleware/loginRateLimitMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const {
    registerValidator,
    emailPasswordValidator,
    invitePasswordValidator,
    refreshTokenValidator,
    forgotRequestValidator,
    forgotVerifyValidator,
    forgotResetValidator,
} = require('../validation/authValidators');

// Public
router.post('/register', validate(registerValidator), register);
router.post('/login', loginIdentifierLimiter, validate(emailPasswordValidator), login);
router.post('/teacher-login', loginIdentifierLimiter, validate(invitePasswordValidator), teacherLogin);
router.post('/student-login', loginIdentifierLimiter, validate(invitePasswordValidator), studentLogin);

// Token lifecycle
router.post('/refresh-token', validate(refreshTokenValidator), refreshAccessToken);
router.post('/logout', validate(refreshTokenValidator), logout);

// Forgot password (public, 3-step flow)
router.post('/forgot-password/request',    validate(forgotRequestValidator), requestPasswordReset);
router.post('/forgot-password/verify-otp', validate(forgotVerifyValidator), verifyResetOTP);
router.post('/forgot-password/reset',      validate(forgotResetValidator), resetPassword);

// Protected
router.get('/me', protect, getMe);
router.get('/sessions', protect, requirePermission('sessions.read'), getSessions);
router.post('/logout-all', protect, validate(refreshTokenValidator), logoutAllExceptCurrent);
router.get('/students', protect, requirePermission('students.read'), getAllStudents);
router.put('/update-profile', protect, requirePermission('profile.update'), updateProfile);
router.put('/admin/set-password', protect, authorize('admin'), requirePermission('users.password.reset'), requireAdminActionOTP('set-password'), adminSetUserPassword);
router.patch('/admin/lock-student', protect, authorize('admin'), requirePermission('students.lock'), requireAdminActionOTP('lock-student'), lockUnlockStudent);

module.exports = router;
