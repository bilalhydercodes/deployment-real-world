// Marks Controller
const Marks = require('../models/Marks');
const User = require('../models/User');
const Session = require('../models/Session');
const { isValidMarks } = require('../utils/validators');

const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, parseInt(query.limit) || 50);
    return { page, limit, skip: (page - 1) * limit };
};

const addMarks = async (req, res, next) => {
    try {
        const { studentId, subject, examType, marks, totalMarks } = req.body;
        const schoolId = req.user.schoolId;
        if (!studentId || !subject || marks === undefined)
            return res.status(400).json({ success: false, message: 'studentId, subject, and marks are required' });

        const maxMarks = totalMarks || 100;
        if (!isValidMarks(marks, maxMarks))
            return res.status(400).json({ success: false, message: `Marks must be between 0 and ${maxMarks}` });

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

        const record = await Marks.create({ schoolId, studentId, subject, examType: examType || 'midterm', marks, totalMarks: maxMarks, enteredBy: req.user._id });
        await record.populate('studentId', 'name');
        res.status(201).json({ success: true, message: 'Marks added', data: record });
    } catch (error) { next(error); }
};

const getMarks = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (req.user.role === 'student' && req.user._id.toString() !== studentId)
            return res.status(403).json({ success: false, message: 'Access denied' });

        const { page, limit, skip } = getPagination(req.query);
        const filter = { studentId, schoolId: req.user.schoolId };

        const [marks, total] = await Promise.all([
            Marks.find(filter).select('subject examType marks totalMarks grade createdAt').populate('enteredBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
            Marks.countDocuments(filter),
        ]);

        const avgPercentage = marks.length > 0
            ? (marks.reduce((s, m) => s + (m.marks / m.totalMarks) * 100, 0) / marks.length).toFixed(1) : 0;

        res.json({ success: true, data: marks, summary: { totalSubjects: total, avgPercentage: `${avgPercentage}%` }, pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total } });
    } catch (error) { next(error); }
};

const getAllMarks = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = { schoolId: req.user.schoolId };

        const [marks, total] = await Promise.all([
            Marks.find(filter).select('studentId subject examType marks totalMarks grade createdAt').populate('studentId', 'name inviteCode').populate('enteredBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
            Marks.countDocuments(filter),
        ]);

        res.json({ success: true, data: marks, pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total } });
    } catch (error) { next(error); }
};

module.exports = { addMarks, getMarks, getAllMarks };
