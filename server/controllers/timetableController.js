const Timetable = require('../models/Timetable');
const cache = require('../utils/cache');

const addEntry = async (req, res, next) => {
    try {
        const { sessionId, dayOfWeek, subject, startTime, endTime, teacher } = req.body;
        if (!sessionId || !dayOfWeek || !subject || !startTime || !endTime)
            return res.status(400).json({ success: false, message: 'Missing required timetable fields' });

        const entry = await Timetable.create({
            schoolId: req.user.schoolId, sessionId, dayOfWeek,
            subject, startTime, endTime, teacher, createdBy: req.user._id,
        });

        // Bust cache so students/teachers see the update immediately
        cache.del(`timetable:${sessionId}`);

        res.status(201).json({ success: true, data: entry });
    } catch (err) { next(err); }
};

const getBySession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const cacheKey = `timetable:${sessionId}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.json({ success: true, data: cached, fromCache: true });

        const entries = await Timetable.find({ sessionId, schoolId: req.user.schoolId })
            .sort('dayOfWeek startTime');

        cache.set(cacheKey, entries, 300); // cache 5 minutes
        res.json({ success: true, data: entries });
    } catch (err) { next(err); }
};

const deleteEntry = async (req, res, next) => {
    try {
        const entry = await Timetable.findOneAndDelete({ _id: req.params.id, schoolId: req.user.schoolId });
        if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });

        // Bust cache so students see the deletion immediately
        cache.del(`timetable:${entry.sessionId}`);

        res.json({ success: true, message: 'Timetable entry deleted' });
    } catch (err) { next(err); }
};

module.exports = { addEntry, getBySession, deleteEntry };
