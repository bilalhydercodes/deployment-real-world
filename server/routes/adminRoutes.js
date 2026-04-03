// Admin routes
const express = require('express');
const router = express.Router();
const { adminUpdatePassword } = require('../controllers/forgotPasswordController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const Fees = require('../models/Fees');
const Discipline = require('../models/Discipline');

// GET /api/admin/stats — single fast endpoint for dashboard counts
router.get('/stats', protect, authorize('admin'), async (req, res, next) => {
    try {
        const [students, teachers, attendance, marks, pendingFees, discipline] = await Promise.all([
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'teacher' }),
            Attendance.countDocuments({}),
            Marks.countDocuments({}),
            Fees.countDocuments({ status: { $in: ['pending', 'overdue'] } }),
            Discipline.countDocuments({}),
        ]);
        res.json({ success: true, data: { students, teachers, attendance, marks, pendingFees, discipline } });
    } catch (err) { next(err); }
});

// PATCH /api/admin/update-password/:userId
router.patch('/update-password/:userId', protect, authorize('admin'), adminUpdatePassword);

module.exports = router;
