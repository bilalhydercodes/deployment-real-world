const Session = require('../models/Session');
const User = require('../models/User');
const generateUniqueCode = require('../utils/generateInviteCode');
const cache = require('../utils/cache');

exports.createSession = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Session name is required' });
        const sessionCode = await generateUniqueCode('SES', 'Session', 'sessionCode');
        const session = await Session.create({ schoolId: req.user.schoolId, name, sessionCode, createdBy: req.user._id });
        cache.del(`sessions:${req.user.schoolId}`);
        res.status(201).json({ success: true, data: session });
    } catch (error) { next(error); }
};

exports.addStudentsToSession = async (req, res, next) => {
    try {
        const { sessionId, studentIds } = req.body;
        if (!sessionId || !studentIds || !Array.isArray(studentIds))
            return res.status(400).json({ success: false, message: 'Invalid data provided' });
        const session = await Session.findOne({ _id: sessionId, schoolId: req.user.schoolId });
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        const newStudents = new Set([...session.students.map(id => id.toString()), ...studentIds]);
        session.students = Array.from(newStudents);
        await session.save();
        cache.del(`sessions:${req.user.schoolId}`);
        res.status(200).json({ success: true, data: session });
    } catch (error) { next(error); }
};

exports.getSessions = async (req, res, next) => {
    try {
        const schoolId = req.user.schoolId;
        const role = String(req.user.role || '').toLowerCase().trim();
        const cacheKey = `sessions:${schoolId}:${role}:${req.user._id}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.status(200).json({ success: true, count: cached.length, data: cached, fromCache: true });

        let query = { schoolId };
        if (role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) orConditions.push({ _id: req.user.classTeacherOf });
            query = { schoolId, $or: orConditions };
        } else if (role === 'student') {
            query = { schoolId, students: req.user._id };
        }
        const sessions = await Session.find(query).populate('students', 'name email inviteCode');
        cache.set(cacheKey, sessions, 60); // 1 minute
        res.status(200).json({ success: true, count: sessions.length, data: sessions });
    } catch (error) { next(error); }
};

exports.claimSession = async (req, res, next) => {
    try {
        let { sessionCode } = req.body;
        if (!sessionCode) return res.status(400).json({ success: false, message: 'Session code is required' });
        sessionCode = sessionCode.trim().toUpperCase();
        const session = await Session.findOne({ sessionCode, schoolId: req.user.schoolId });
        if (!session) return res.status(404).json({ success: false, message: 'Invalid session code.' });
        if (!session.teachers.includes(req.user._id)) {
            session.teachers.push(req.user._id);
            await session.save();
            cache.del(`sessions:${req.user.schoolId}`);
        }
        res.status(200).json({ success: true, message: 'Session claimed successfully!', data: session });
    } catch (error) { next(error); }
};
