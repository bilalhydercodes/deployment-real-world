// Fees routes
const express = require('express');
const router = express.Router();
const { addFee, payFee, getFees, getAllFees } = require('../controllers/feesController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Add fee record - Admin only
router.post('/add', protect, authorize('admin'), addFee);

// Mark fee as paid - Admin only
router.post('/pay', protect, authorize('admin'), payFee);

// Get all fees - Admin only
router.get('/', protect, authorize('admin'), getAllFees);

// Get fees for a specific student - admin and teacher
router.get('/:studentId', protect, authorize('admin', 'teacher', 'student'), getFees);

module.exports = router;
