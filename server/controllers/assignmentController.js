const Assignment = require('../models/Assignment');

/** POST /api/assignments  –  Teacher/Admin */
const createAssignment = async (req, res, next) => {
    try {
        const { title, description, subject, dueDate, sessionId } = req.body;
        if (!title || !subject || !dueDate || !sessionId) {
            return res.status(400).json({ success: false, message: 'title, subject, dueDate, sessionId required' });
        }
        const assignment = await Assignment.create({ title, description, subject, dueDate, sessionId, createdBy: req.user._id });
        res.status(201).json({ success: true, data: assignment });
    } catch (err) {
        next(err);
    }
};

/** GET /api/assignments/session/:sessionId  –  Any authenticated user */
const getBySession = async (req, res, next) => {
    try {
        const assignments = await Assignment.find({ sessionId: req.params.sessionId })
            .populate('createdBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: assignments });
    } catch (err) {
        next(err);
    }
};

/** GET /api/assignments  –  Admin/Teacher (all assignments they created) */
const getMyAssignments = async (req, res, next) => {
    try {
        const filter = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
        const assignments = await Assignment.find(filter)
            .populate('sessionId', 'name sessionCode')
            .populate('createdBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: assignments });
    } catch (err) {
        next(err);
    }
};

/** POST /api/assignments/:id/submit  –  Student */
const submitAssignment = async (req, res, next) => {
    try {
        const assignment = await Assignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

        // Prevent duplicate submissions
        const alreadySubmitted = assignment.submissions.some(s => String(s.student) === String(req.user._id));
        if (alreadySubmitted) {
            return res.status(400).json({ success: false, message: 'Already submitted' });
        }

        assignment.submissions.push({ student: req.user._id, note: req.body.note || '' });
        await assignment.save();
        res.json({ success: true, message: 'Assignment submitted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = { createAssignment, getBySession, getMyAssignments, submitAssignment };
