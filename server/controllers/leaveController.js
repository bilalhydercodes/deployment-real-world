const LeaveRequest = require('../models/LeaveRequest');

/** POST /api/leaves/apply  –  Student */
const applyLeave = async (req, res, next) => {
    try {
        const { reason, fromDate, toDate } = req.body;
        if (!reason || !fromDate || !toDate) {
            return res.status(400).json({ success: false, message: 'reason, fromDate, toDate are required' });
        }
        if (new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({ success: false, message: 'fromDate must be before toDate' });
        }
        const leave = await LeaveRequest.create({ student: req.user._id, reason, fromDate, toDate });
        res.status(201).json({ success: true, data: leave });
    } catch (err) {
        next(err);
    }
};

/** GET /api/leaves/my  –  Student */
const getMyLeaves = async (req, res, next) => {
    try {
        const leaves = await LeaveRequest.find({ student: req.user._id })
            .populate('reviewedBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: leaves });
    } catch (err) {
        next(err);
    }
};

/** GET /api/leaves  –  Admin/Teacher */
const getAllLeaves = async (req, res, next) => {
    try {
        const leaves = await LeaveRequest.find()
            .populate('student', 'name inviteCode')
            .populate('reviewedBy', 'name')
            .sort('-createdAt');
        res.json({ success: true, data: leaves });
    } catch (err) {
        next(err);
    }
};

/** PATCH /api/leaves/:id/status  –  Admin/Teacher */
const updateLeaveStatus = async (req, res, next) => {
    try {
        const { status, reviewNote } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
        }
        const leave = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            { status, reviewNote: reviewNote || '', reviewedBy: req.user._id },
            { new: true }
        ).populate('student', 'name');

        if (!leave) return res.status(404).json({ success: false, message: 'Leave request not found' });
        res.json({ success: true, data: leave });
    } catch (err) {
        next(err);
    }
};

module.exports = { applyLeave, getMyLeaves, getAllLeaves, updateLeaveStatus };
