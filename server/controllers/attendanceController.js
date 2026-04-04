// Attendance Controller
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Session = require('../models/Session');

const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, parseInt(query.limit) || 50);
    return { page, limit, skip: (page - 1) * limit };
};

const markAttendance = async (req, res, next) => {
    try {
        const { studentId, subject, date, status } = req.body;
        const schoolId = req.user.schoolId;
        if (!studentId || !subject || !status)
            return res.status(400).json({ success: false, message: 'studentId, subject, and status are required' });

        const student = await User.findOne({ _id: studentId, role: 'student', schoolId });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        if (req.user.role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) orConditions.push({ _id: req.user.classTeacherOf });
            const sessions = await Session.find({ $or: orConditions, schoolId }).select('students');
            const allowed = new Set(sessions.flatMap(s => s.students.map(id => id.toString())));
            if (!allowed.has(studentId))
                return res.status(403).json({ success: false, message: 'Student is not in your sessions' });
        }

        const attendance = await Attendance.create({
            schoolId, studentId, subject, date: date || new Date(), status, markedBy: req.user._id,
        });
        await attendance.populate('studentId', 'name');
        await attendance.populate('markedBy', 'name');
        res.status(201).json({ success: true, message: 'Attendance marked', data: attendance });
    } catch (error) { next(error); }
};

const getAttendance = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (req.user.role === 'student' && req.user._id.toString() !== studentId)
            return res.status(403).json({ success: false, message: 'Access denied' });

        const { page, limit, skip } = getPagination(req.query);
        const filter = { studentId, schoolId: req.user.schoolId };

        const [attendance, total] = await Promise.all([
            Attendance.find(filter).select('subject date status markedBy').populate('markedBy', 'name').sort({ date: -1 }).skip(skip).limit(limit),
            Attendance.countDocuments(filter),
        ]);

        const all = await Attendance.find(filter).select('status');
        const present = all.filter(a => a.status === 'present').length;
        const absent  = all.filter(a => a.status === 'absent').length;
        const late    = all.filter(a => a.status === 'late').length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        res.json({
            success: true, data: attendance,
            summary: { total, present, absent, late, percentage: `${percentage}%` },
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) { next(error); }
};

const getAllAttendance = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = { schoolId: req.user.schoolId };

        const [attendance, total] = await Promise.all([
            Attendance.find(filter).select('studentId subject date status markedBy').populate('studentId', 'name inviteCode').populate('markedBy', 'name').sort({ date: -1 }).skip(skip).limit(limit),
            Attendance.countDocuments(filter),
        ]);

        res.json({ success: true, data: attendance, pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total } });
    } catch (error) { next(error); }
};

const bulkMarkAttendance = async (req, res, next) => {
    try {
        const { records } = req.body;
        const schoolId = req.user.schoolId;
        if (!Array.isArray(records) || records.length === 0)
            return res.status(400).json({ success: false, message: 'records array is required' });

        let allowedIds = null;
        if (req.user.role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) orConditions.push({ _id: req.user.classTeacherOf });
            const sessions = await Session.find({ $or: orConditions, schoolId }).select('students');
            allowedIds = new Set(sessions.flatMap(s => s.students.map(id => id.toString())));
        }

        const formatted = records
            .filter(r => !allowedIds || allowedIds.has(r.studentId))
            .map(r => ({ schoolId, studentId: r.studentId, subject: r.subject, date: r.date || new Date(), status: r.status, markedBy: req.user._id }));

        if (formatted.length === 0)
            return res.status(403).json({ success: false, message: 'No authorised students in records' });

        await Attendance.insertMany(formatted);
        res.status(201).json({ success: true, count: formatted.length, message: 'Bulk attendance saved' });
    } catch (error) { next(error); }
};

module.exports = { markAttendance, getAttendance, getAllAttendance, bulkMarkAttendance };
