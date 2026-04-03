// Discipline Controller
const Discipline = require('../models/Discipline');
const User = require('../models/User');

const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, parseInt(query.limit) || 50);
    return { page, limit, skip: (page - 1) * limit };
};

/**
 * @desc    Teacher reports a discipline case
 * @route   POST /api/discipline/report
 * @access  Private (Teacher/Admin)
 */
const reportDiscipline = async (req, res, next) => {
    try {
        const { studentId, reason, severity, date } = req.body;
        if (!studentId || !reason) {
            return res.status(400).json({ success: false, message: 'studentId and reason are required' });
        }

        const student = await User.findById(studentId).select('_id role');
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const record = await Discipline.create({
            student: studentId, reportedBy: req.user._id,
            reason, severity: severity || 'low', date: date || new Date(),
        });
        await record.populate('student', 'name inviteCode');
        await record.populate('reportedBy', 'name');

        res.status(201).json({ success: true, message: 'Discipline case reported', data: record });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all discipline cases — Admin (all) / Teacher (own reports), paginated
 * @route   GET /api/discipline?page=1&limit=50&action=pending
 * @access  Private (Admin/Teacher)
 */
const getAllDiscipline = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);

        const filter = req.user.role === 'teacher' ? { reportedBy: req.user._id } : {};
        if (req.query.action) filter.action = req.query.action;
        if (req.query.severity) filter.severity = req.query.severity;

        const [records, total] = await Promise.all([
            Discipline.find(filter)
                .select('student reportedBy reason severity date action actionNote actionBy actionDate')
                .populate('student', 'name inviteCode')
                .populate('reportedBy', 'name')
                .populate('actionBy', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit),
            Discipline.countDocuments(filter),
        ]);

        res.json({
            success: true,
            count: records.length,
            data: records,
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get discipline records for a specific student (paginated)
 * @route   GET /api/discipline/student/:studentId
 * @access  Private (Admin/Teacher/Student-own)
 */
const getStudentDiscipline = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { page, limit, skip } = getPagination(req.query);

        const [records, total] = await Promise.all([
            Discipline.find({ student: studentId })
                .select('reason severity date action actionNote reportedBy actionDate')
                .populate('reportedBy', 'name')
                .populate('actionBy', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit),
            Discipline.countDocuments({ student: studentId }),
        ]);

        res.json({
            success: true,
            data: records,
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Admin takes action on a discipline case
 * @route   PATCH /api/discipline/:id/action
 * @access  Private/Admin
 */
const takeAction = async (req, res, next) => {
    try {
        const { action, actionNote } = req.body;
        const valid = ['warning', 'suspend', 'notify_parent', 'resolved'];
        if (!action || !valid.includes(action)) {
            return res.status(400).json({ success: false, message: `action must be one of: ${valid.join(', ')}` });
        }

        const record = await Discipline.findByIdAndUpdate(
            req.params.id,
            { action, actionNote: actionNote || '', actionBy: req.user._id, actionDate: new Date() },
            { new: true }
        )
            .populate('student', 'name inviteCode')
            .populate('reportedBy', 'name')
            .populate('actionBy', 'name');

        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

        res.json({ success: true, message: 'Action recorded', data: record });
    } catch (error) {
        next(error);
    }
};

module.exports = { reportDiscipline, getAllDiscipline, getStudentDiscipline, takeAction };
