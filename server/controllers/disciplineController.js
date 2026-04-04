// Discipline Controller
const Discipline = require('../models/Discipline');
const User = require('../models/User');

const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, parseInt(query.limit) || 50);
    return { page, limit, skip: (page - 1) * limit };
};

const reportDiscipline = async (req, res, next) => {
    try {
        const { studentId, reason, severity, date } = req.body;
        const schoolId = req.user.schoolId;
        if (!studentId || !reason)
            return res.status(400).json({ success: false, message: 'studentId and reason are required' });

        const student = await User.findOne({ _id: studentId, role: 'student', schoolId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const record = await Discipline.create({ schoolId, student: studentId, reportedBy: req.user._id, reason, severity: severity || 'low', date: date || new Date() });
        await record.populate('student', 'name inviteCode');
        await record.populate('reportedBy', 'name');
        res.status(201).json({ success: true, message: 'Discipline case reported', data: record });
    } catch (error) { next(error); }
};

const getAllDiscipline = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = { schoolId: req.user.schoolId };
        if (req.user.role === 'teacher') filter.reportedBy = req.user._id;
        if (req.query.action) filter.action = req.query.action;
        if (req.query.severity) filter.severity = req.query.severity;

        const [records, total] = await Promise.all([
            Discipline.find(filter).select('student reportedBy reason severity date action actionNote actionBy actionDate').populate('student', 'name inviteCode').populate('reportedBy', 'name').populate('actionBy', 'name').sort({ date: -1 }).skip(skip).limit(limit),
            Discipline.countDocuments(filter),
        ]);

        res.json({ success: true, count: records.length, data: records, pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total } });
    } catch (error) { next(error); }
};

const getStudentDiscipline = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (req.user.role === 'student' && req.user._id.toString() !== studentId)
            return res.status(403).json({ success: false, message: 'Access denied' });

        const { page, limit, skip } = getPagination(req.query);
        const filter = { student: studentId, schoolId: req.user.schoolId };

        const [records, total] = await Promise.all([
            Discipline.find(filter).select('reason severity date action actionNote reportedBy actionDate').populate('reportedBy', 'name').populate('actionBy', 'name').sort({ date: -1 }).skip(skip).limit(limit),
            Discipline.countDocuments(filter),
        ]);

        res.json({ success: true, data: records, pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total } });
    } catch (error) { next(error); }
};

const takeAction = async (req, res, next) => {
    try {
        const { action, actionNote } = req.body;
        const valid = ['warning', 'suspend', 'notify_parent', 'resolved'];
        if (!action || !valid.includes(action))
            return res.status(400).json({ success: false, message: `action must be one of: ${valid.join(', ')}` });

        const record = await Discipline.findOneAndUpdate(
            { _id: req.params.id, schoolId: req.user.schoolId },
            { action, actionNote: actionNote || '', actionBy: req.user._id, actionDate: new Date() },
            { new: true }
        ).populate('student', 'name inviteCode').populate('reportedBy', 'name').populate('actionBy', 'name');

        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
        res.json({ success: true, message: 'Action recorded', data: record });
    } catch (error) { next(error); }
};

module.exports = { reportDiscipline, getAllDiscipline, getStudentDiscipline, takeAction };
