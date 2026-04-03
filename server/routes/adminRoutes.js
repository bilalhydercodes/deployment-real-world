// Admin routes
const express = require('express');
const router = express.Router();
const { adminUpdatePassword } = require('../controllers/forgotPasswordController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// PATCH /api/admin/update-password/:userId
router.patch('/update-password/:userId', protect, authorize('admin'), adminUpdatePassword);

module.exports = router;
