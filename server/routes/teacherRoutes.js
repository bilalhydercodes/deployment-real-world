const express = require('express');
const router = express.Router();
const User = require('../models/User');
const generateUniqueCode = require('../utils/generateInviteCode');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { isValidPassword, passwordRules } = require('../utils/validators');

/**
 * @desc    Create a new student (generates an invite code)
 * @route   POST /api/teacher/create-student
 * @access  Private (Admin or Teacher)
 */
router.post('/create-student', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({ success: false, message: 'Name and initial password are required' });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: passwordRules });
        }

        // Email is optional for students, but if provided, it must be unique. Let mongoose handle the uniqueness.

        // Generate the unique STU-XXXXXX invite code
        const inviteCode = await generateUniqueCode();

        // Create the student document
        const student = await User.create({
            name,
            email: email || undefined, // undefined prevents sparse index collisions on empty strings
            password,
            role: 'student',
            inviteCode,
            createdBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: {
                _id: student._id,
                name: student.name,
                inviteCode: student.inviteCode,
            },
        });

    } catch (error) {
        next(error);
    }
});

/**
 * @desc    Create a new teacher (generates a TCH- invite code)
 * @route   POST /api/teacher/create-teacher
 * @access  Private (Admin only)
 */
router.post('/create-teacher', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { name, email, password, mobile, sessionId } = req.body;

        if (!name || !password) {
            return res.status(400).json({ success: false, message: 'Name and initial password are required' });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: passwordRules });
        }

        // Generate TCH-XXXXXX invite code
        const inviteCode = await generateUniqueCode('TCH', 'User', 'inviteCode');

        const teacher = await User.create({
            name,
            email: email || undefined,
            mobile: mobile || undefined,
            classTeacherOf: sessionId || undefined,
            password,
            role: 'teacher',
            inviteCode,
            createdBy: req.user._id,
        });

        res.status(201).json({
            success: true,
            message: 'Teacher created successfully',
            data: {
                _id: teacher._id,
                name: teacher.name,
                inviteCode: teacher.inviteCode,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @desc    List all teachers (for Admin only)
 * @route   GET /api/teacher/all
 * @access  Private (Admin only)
 */
router.get('/all', protect, authorize('admin'), async (req, res, next) => {
    try {
        const teachers = await User.find({ role: 'teacher' })
            .populate('classTeacherOf', 'name')
            .select('-password');
        res.json({ success: true, data: teachers });
    } catch (error) {
        next(error);
    }
});

/**
 * @desc    Delete a teacher
 * @route   DELETE /api/teacher/:id
 * @access  Private (Admin only)
 */
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const teacher = await User.findOneAndDelete({ _id: req.params.id, role: 'teacher' });
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        res.json({ success: true, message: 'Teacher deleted successfully' });
    } catch (error) {
        next(error);
    }
});

/**
 * @desc    Update a teacher details
 * @route   PUT /api/teacher/:id
 * @access  Private (Admin only)
 */
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { name, email, mobile, sessionId } = req.body;
        
        const teacher = await User.findOne({ _id: req.params.id, role: 'teacher' });
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }

        if (name) teacher.name = name;
        if (email !== undefined) teacher.email = email || undefined;
        if (mobile !== undefined) teacher.mobile = mobile || undefined;
        if (sessionId !== undefined) teacher.classTeacherOf = sessionId || undefined;

        await teacher.save();

        const updatedTeacher = await User.findById(teacher._id)
            .populate('classTeacherOf', 'name')
            .select('-password');

        res.json({ success: true, message: 'Teacher updated successfully', data: updatedTeacher });
    } catch (error) {
        next(error);
    }
});

/**
 * @desc    Login teacher via Invite Code + password
 * @route   POST /api/teacher/teacher-login
 * @access  Public
 */
router.post('/teacher-login', require('../controllers/authController').teacherLogin);

/**
 * @desc    Bulk Create Students
 * @route   POST /api/teacher/bulk-create-student
 * @access  Private (Admin only)
 */
router.post('/bulk-create-student', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { students, sessionId } = req.body;
        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide an array of students' });
        }

        const createdStudents = [];

        for (const stu of students) {
            if (!stu.name || !stu.password) continue;

            const inviteCode = await generateUniqueCode('STU', 'User', 'inviteCode');
            const newStudent = await User.create({
                name: stu.name,
                email: stu.email || undefined,
                password: stu.password,
                role: 'student',
                inviteCode,
                createdBy: req.user._id
            });

            createdStudents.push(newStudent);
        }

        if (sessionId && createdStudents.length > 0) {
            const Session = require('../models/Session');
            const session = await Session.findById(sessionId);
            if (session) {
                const newIds = createdStudents.map(s => s._id.toString());
                const combined = new Set([...session.students.map(id => id.toString()), ...newIds]);
                session.students = Array.from(combined);
                await session.save();
            }
        }

        res.status(201).json({
            success: true,
            count: createdStudents.length,
            data: createdStudents.map(s => ({
                name: s.name,
                email: s.email,
                inviteCode: s.inviteCode
            }))
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
