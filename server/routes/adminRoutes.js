// Admin routes
const express = require('express');
const router = express.Router();
const { adminUpdatePassword } = require('../controllers/forgotPasswordController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { requestAdminActionOTP, verifyAdminActionOTP } = require('../controllers/adminOtpController');
const { requireAdminActionOTP } = require('../middleware/adminActionOtpMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { adminOtpRequestValidator, adminOtpVerifyValidator } = require('../validation/otpValidators');
const { adminPasswordUpdateValidator } = require('../validation/authValidators');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const Fees = require('../models/Fees');
const Discipline = require('../models/Discipline');
const LeaveRequest = require('../models/LeaveRequest');
const ClassRequest = require('../models/ClassRequest');

// GET /api/admin/stats — single fast endpoint for dashboard counts
router.get('/stats', protect, authorize('admin'), async (req, res, next) => {
    try {
        const schoolId = req.user.schoolId;
        const [students, teachers, attendance, marks, pendingFees, discipline, pendingLeaves, pendingClassRequests, pendingDiscipline] = await Promise.all([
            User.countDocuments({ role: 'student', schoolId }),
            User.countDocuments({ role: 'teacher', schoolId }),
            Attendance.countDocuments({ schoolId }),
            Marks.countDocuments({ schoolId }),
            Fees.countDocuments({ status: { $in: ['pending', 'overdue'] }, schoolId }),
            Discipline.countDocuments({ schoolId }),
            LeaveRequest.countDocuments({ status: 'pending', schoolId }),
            ClassRequest.countDocuments({ status: 'pending', schoolId }),
            Discipline.countDocuments({ action: 'pending', schoolId }),
        ]);
        res.json({ success: true, code: 'ADMIN_STATS_OK', message: 'Admin stats fetched', data: { students, teachers, attendance, marks, pendingFees, discipline, pendingLeaves, pendingClassRequests, pendingDiscipline } });
    } catch (err) { next(err); }
});

// Admin action OTP (step-up authentication)
router.post('/otp/request', protect, authorize('admin'), requirePermission('security.otp.manage'), validate(adminOtpRequestValidator), requestAdminActionOTP);
router.post('/otp/verify', protect, authorize('admin'), requirePermission('security.otp.manage'), validate(adminOtpVerifyValidator), verifyAdminActionOTP);

// PATCH /api/admin/update-password/:userId
router.patch('/update-password/:userId', protect, authorize('admin'), requirePermission('users.password.reset'), validate(adminPasswordUpdateValidator), requireAdminActionOTP('update-password'), adminUpdatePassword);

// PATCH /api/admin/update-student/:id — admin edits student name/email
router.patch('/update-student/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { name, email } = req.body;
        const student = await User.findById(req.params.id);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        if (name) student.name = name.trim();
        if (email !== undefined) student.email = email.trim();
        await student.save();
        res.json({ success: true, code: 'STUDENT_UPDATED', message: 'Student updated', data: { _id: student._id, name: student.name, email: student.email } });
    } catch (err) { next(err); }
});

module.exports = router;
