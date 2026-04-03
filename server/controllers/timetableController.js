const Timetable = require('../models/Timetable');

/** POST /api/timetable  –  Admin */
const addEntry = async (req, res, next) => {
    try {
        const { sessionId, dayOfWeek, subject, startTime, endTime, teacher } = req.body;
        if (!sessionId || !dayOfWeek || !subject || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'Missing required timetable fields' });
        }
        const entry = await Timetable.create({ sessionId, dayOfWeek, subject, startTime, endTime, teacher, createdBy: req.user._id });
        res.status(201).json({ success: true, data: entry });
    } catch (err) {
        next(err);
    }
};

/** GET /api/timetable/:sessionId  –  Any authenticated user */
const getBySession = async (req, res, next) => {
    try {
        const entries = await Timetable.find({ sessionId: req.params.sessionId }).sort('dayOfWeek startTime');
        res.json({ success: true, data: entries });
    } catch (err) {
        next(err);
    }
};

/** DELETE /api/timetable/:id  –  Admin */
const deleteEntry = async (req, res, next) => {
    try {
        const entry = await Timetable.findByIdAndDelete(req.params.id);
        if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
        res.json({ success: true, message: 'Timetable entry deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = { addEntry, getBySession, deleteEntry };
