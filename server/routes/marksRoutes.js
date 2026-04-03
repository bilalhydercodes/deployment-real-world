// Marks routes
const express = require('express');
const router = express.Router();
const { addMarks, getMarks, getAllMarks } = require('../controllers/marksController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Add marks - Teacher/Admin only
router.post('/add', protect, authorize('teacher', 'admin'), addMarks);

// Get all marks - Admin only
router.get('/', protect, authorize('admin'), getAllMarks);

// Get marks for a specific student - all roles (student sees own only)
router.get('/:studentId', protect, getMarks);

module.exports = router;
