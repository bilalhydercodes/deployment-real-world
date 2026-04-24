// OTP routes - for student signup parent verification
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/otpController');
const { validate } = require('../middleware/validationMiddleware');
const { sendOtpValidator, verifyOtpValidator } = require('../validation/otpValidators');

// Public routes — no auth required
router.post('/send-otp', validate(sendOtpValidator), sendOTP);
router.post('/verify-otp', validate(verifyOtpValidator), verifyOTP);

module.exports = router;
