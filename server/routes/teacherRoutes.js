const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { teacherLogin } = require('../controllers/authController');
const { requireAdminActionOTP } = require('../middleware/adminActionOtpMiddleware');
const {
    createStudent,
    createTeacher,
    getAllTeachers,
    deleteTeacher,
    updateTeacher,
    bulkCreateStudents,
} = require('../controllers/teacherController');

router.post('/create-student', protect, authorize('admin'), requirePermission('teachers.manage'), requireAdminActionOTP('create-student'), createStudent);
router.post('/create-teacher', protect, authorize('admin'), requirePermission('teachers.manage'), requireAdminActionOTP('create-teacher'), createTeacher);
router.get('/all', protect, authorize('admin'), requirePermission('teachers.manage'), getAllTeachers);
router.delete('/:id', protect, authorize('admin'), requirePermission('teachers.manage'), requireAdminActionOTP('delete-teacher'), deleteTeacher);
router.put('/:id', protect, authorize('admin'), requirePermission('teachers.manage'), requireAdminActionOTP('update-teacher'), updateTeacher);

// Legacy endpoint still used by login page
router.post('/teacher-login', teacherLogin);
router.post('/bulk-create-student', protect, authorize('admin'), requirePermission('teachers.manage'), requireAdminActionOTP('bulk-create-student'), bulkCreateStudents);

module.exports = router;
