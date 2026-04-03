// Attendance routes
const express = require('express');
const router = express.Router();
const {
    markAttendance,
    getAttendance,
    getAllAttendance,
    bulkMarkAttendance
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Mark attendance - Teacher/Admin only
router.post('/mark', protect, authorize('teacher', 'admin'), markAttendance);
router.post('/bulk-mark', protect, authorize('teacher', 'admin'), bulkMarkAttendance);

// Get all attendance records - Admin only
router.get('/', protect, authorize('admin'), getAllAttendance);

// Get attendance for specific student - all roles (student sees own only)
router.get('/:studentId', protect, getAttendance);

module.exports = router;
