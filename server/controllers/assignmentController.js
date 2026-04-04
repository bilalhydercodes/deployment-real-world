const Assignment = require('../models/Assignment');

const createAssignment = async (req, res, next) => {
    try {
        const { title, description, subject, dueDate, sessionId } = req.body;
        if (!title || !subject || !dueDate || !sessionId)
            return res.status(400).json({ success: false, message: 'title, subject, dueDate, sessionId required' });
        const assignment = await Assignment.create({ schoolId: req.user.schoolId, title, description, subject, dueDate, sessionId, createdBy: req.user._id });
        res.status(201).json({ success: true, data: assignment });
    } catch (err) { next(err); }
};

const getBySession = async (req, res, next) => {
    try {
        const assignments = await Assignment.find({ sessionId: req.params.sessionId, schoolId: req.user.schoolId })
            .populate('createdBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: assignments });
    } catch (err) { next(err); }
};

const getMyAssignments = async (req, res, next) => {
    try {
        const filter = { schoolId: req.user.schoolId, ...(req.user.role !== 'admin' ? { createdBy: req.user._id } : {}) };
        const assignments = await Assignment.find(filter)
            .populate('sessionId', 'name sessionCode')
            .populate('createdBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: assignments });
    } catch (err) { next(err); }
};

const submitAssignment = async (req, res, next) => {
    try {
        const assignment = await Assignment.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        const alreadySubmitted = assignment.submissions.some(s => String(s.student) === String(req.user._id));
        if (alreadySubmitted) return res.status(400).json({ success: false, message: 'Already submitted' });

        assignment.submissions.push({ student: req.user._id, note: req.body.note || '' });
        await assignment.save();
        res.json({ success: true, message: 'Assignment submitted successfully' });
    } catch (err) { next(err); }
};

module.exports = { createAssignment, getBySession, getMyAssignments, submitAssignment };
