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
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/teacher-login', teacherLogin);
router.post('/student-login', studentLogin);

// Forgot password (public, 3-step flow)
router.post('/forgot-password/request',    requestPasswordReset);
router.post('/forgot-password/verify-otp', verifyResetOTP);
router.post('/forgot-password/reset',      resetPassword);

// Protected
router.get('/me', protect, getMe);
router.get('/students', protect, authorize('admin', 'teacher'), getAllStudents);
router.put('/update-profile', protect, updateProfile);
router.put('/admin/set-password', protect, authorize('admin'), adminSetUserPassword);
router.patch('/admin/lock-student', protect, authorize('admin'), lockUnlockStudent);

module.exports = router;
