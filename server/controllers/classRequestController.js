const ClassRequest = require('../models/ClassRequest');
const Timetable = require('../models/Timetable');
const cache = require('../utils/cache');

// POST /api/class-requests — Teacher submits a request
const createRequest = async (req, res, next) => {
    try {
        const { sessionId, dayOfWeek, subject, startTime, endTime, reason } = req.body;
        if (!sessionId || !dayOfWeek || !subject || !startTime || !endTime)
            return res.status(400).json({ success: false, message: 'sessionId, dayOfWeek, subject, startTime, endTime are required' });

        const request = await ClassRequest.create({
            schoolId: req.user.schoolId,
            teacher: req.user._id,
            sessionId, dayOfWeek, subject, startTime, endTime,
            reason: reason || '',
        });
        await request.populate('teacher', 'name');
        await request.populate('sessionId', 'name sessionCode');

        res.status(201).json({ success: true, message: 'Class request submitted', data: request });
    } catch (err) { next(err); }
};

// GET /api/class-requests/my — Teacher sees their own requests
const getMyRequests = async (req, res, next) => {
    try {
        const requests = await ClassRequest.find({ teacher: req.user._id, schoolId: req.user.schoolId })
            .populate('sessionId', 'name sessionCode')
            .populate('reviewedBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: requests });
    } catch (err) { next(err); }
};

// GET /api/class-requests — Admin sees all requests
const getAllRequests = async (req, res, next) => {
    try {
        const filter = { schoolId: req.user.schoolId };
        if (req.query.status) filter.status = req.query.status;

        const requests = await ClassRequest.find(filter)
            .populate('teacher', 'name inviteCode')
            .populate('sessionId', 'name sessionCode')
            .populate('reviewedBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: requests });
    } catch (err) { next(err); }
};

// PATCH /api/class-requests/:id — Admin approves or rejects
const reviewRequest = async (req, res, next) => {
    try {
        const { status, reviewNote } = req.body;
        if (!['approved', 'rejected'].includes(status))
            return res.status(400).json({ success: false, message: 'status must be approved or rejected' });

        const request = await ClassRequest.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
            .populate('teacher', 'name');
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

        request.status = status;
        request.reviewNote = reviewNote || '';
        request.reviewedBy = req.user._id;
        await request.save();

        // If approved → auto-add to timetable
        if (status === 'approved') {
            await Timetable.create({
                schoolId: request.schoolId,
                sessionId: request.sessionId,
                dayOfWeek: request.dayOfWeek,
                subject: request.subject,
                startTime: request.startTime,
                endTime: request.endTime,
                teacher: request.teacher.name,
                createdBy: req.user._id,
            });
            // Bust timetable cache for this session
            cache.del(`timetable:${request.sessionId}`);
            cache.del(`sessions:${request.schoolId}`);
        }

        res.json({ success: true, message: `Request ${status}`, data: request });
    } catch (err) { next(err); }
};

module.exports = { createRequest, getMyRequests, getAllRequests, reviewRequest };
