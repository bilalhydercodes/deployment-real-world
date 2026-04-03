// Attendance Controller
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Session = require('../models/Session');

/** Helper: parse pagination query params */
const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, parseInt(query.limit) || 50);
    const skip  = (page - 1) * limit;
    return { page, limit, skip };
};

/**
 * @desc    Mark attendance for a single student
 * @route   POST /api/attendance/mark
 * @access  Private (Teacher/Admin)
 */
const markAttendance = async (req, res, next) => {
    try {
        const { studentId, subject, date, status } = req.body;
        if (!studentId || !subject || !status) {
            return res.status(400).json({ success: false, message: 'studentId, subject, and status are required' });
        }

        const student = await User.findById(studentId).select('_id role');
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Teacher: verify student is in one of their sessions
        if (req.user.role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) orConditions.push({ _id: req.user.classTeacherOf });
            const sessions = await Session.find({ $or: orConditions }).select('students');
            const allowed = new Set(sessions.flatMap(s => s.students.map(id => id.toString())));
            if (!allowed.has(studentId)) {
                return res.status(403).json({ success: false, message: 'Student is not in your sessions' });
            }
        }

        const attendance = await Attendance.create({
            studentId, subject, date: date || new Date(), status, markedBy: req.user._id,
        });
        await attendance.populate('studentId', 'name');
        await attendance.populate('markedBy', 'name');

        res.status(201).json({ success: true, message: 'Attendance marked', data: attendance });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get attendance for a specific student (with pagination)
 * @route   GET /api/attendance/:studentId?page=1&limit=50
 * @access  Private
 */
const getAttendance = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { page, limit, skip } = getPagination(req.query);

        const [attendance, total] = await Promise.all([
            Attendance.find({ studentId })
                .select('subject date status markedBy')
                .populate('markedBy', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit),
            Attendance.countDocuments({ studentId }),
        ]);

        // Summary stats (across ALL records, not just this page)
        const all = await Attendance.find({ studentId }).select('status');
        const present = all.filter(a => a.status === 'present').length;
        const absent  = all.filter(a => a.status === 'absent').length;
        const late    = all.filter(a => a.status === 'late').length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            data: attendance,
            summary: { total, present, absent, late, percentage: `${percentage}%` },
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all attendance records — Admin (paginated)
 * @route   GET /api/attendance?page=1&limit=50
 * @access  Private/Admin
 */
const getAllAttendance = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);

        const [attendance, total] = await Promise.all([
            Attendance.find({})
                .select('studentId subject date status markedBy')
                .populate('studentId', 'name inviteCode')
                .populate('markedBy', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit),
            Attendance.countDocuments(),
        ]);

        res.json({
            success: true,
            data: attendance,
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Bulk mark attendance for a whole class
 * @route   POST /api/attendance/bulk-mark
 * @access  Private (Teacher/Admin)
 */
const bulkMarkAttendance = async (req, res, next) => {
    try {
        const { records } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'records array is required' });
        }

        let allowedIds = null;
        if (req.user.role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) orConditions.push({ _id: req.user.classTeacherOf });
            const sessions = await Session.find({ $or: orConditions }).select('students');
            allowedIds = new Set(sessions.flatMap(s => s.students.map(id => id.toString())));
        }

        const formatted = records
            .filter(r => !allowedIds || allowedIds.has(r.studentId))
            .map(r => ({ studentId: r.studentId, subject: r.subject, date: r.date || new Date(), status: r.status, markedBy: req.user._id }));

        if (formatted.length === 0) {
            return res.status(403).json({ success: false, message: 'No authorised students in records' });
        }

        await Attendance.insertMany(formatted);
        res.status(201).json({ success: true, count: formatted.length, message: 'Bulk attendance saved' });
    } catch (error) {
        next(error);
    }
};

module.exports = { markAttendance, getAttendance, getAllAttendance, bulkMarkAttendance };
