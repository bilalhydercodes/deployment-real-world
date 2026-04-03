const Session = require('../models/Session');
const generateUniqueCode = require('../utils/generateInviteCode');

// @desc    Create a new session
// @route   POST /api/sessions/create
// @access  Private (Admin)
exports.createSession = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Session name is required' });

        const sessionCode = await generateUniqueCode('SES', 'Session', 'sessionCode');

        const session = await Session.create({
            name,
            sessionCode,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

// @desc    Add students to a session
// @route   POST /api/sessions/add-students
// @access  Private (Admin)
exports.addStudentsToSession = async (req, res, next) => {
    try {
        const { sessionId, studentIds } = req.body;
        if (!sessionId || !studentIds || !Array.isArray(studentIds)) {
            return res.status(400).json({ success: false, message: 'Invalid data provided' });
        }

        const session = await Session.findById(sessionId);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        // Merge array without duplicates using Strings for comparison
        const newStudents = new Set([...session.students.map(id => id.toString()), ...studentIds]);
        session.students = Array.from(newStudents);
        await session.save();

        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all sessions (Admin) or my sessions (Teacher)
// @route   GET /api/sessions
// @access  Private (Admin, Teacher)
exports.getSessions = async (req, res, next) => {
    try {
        let query = {};
        const role = String(req.user.role || '').toLowerCase().trim();
        if (role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) {
                orConditions.push({ _id: req.user.classTeacherOf });
            }
            query = { $or: orConditions };
        }
        const sessions = await Session.find(query).populate('students', 'name email inviteCode');
        res.status(200).json({ success: true, count: sessions.length, data: sessions });
    } catch (error) {
        next(error);
    }
};

// @desc    Claim a session (Teacher)
// @route   POST /api/sessions/claim
// @access  Private (Teacher)
exports.claimSession = async (req, res, next) => {
    try {
        let { sessionCode } = req.body;
        if (!sessionCode) return res.status(400).json({ success: false, message: 'Session code is required' });
        sessionCode = sessionCode.trim().toUpperCase();

        const session = await Session.findOne({ sessionCode });
        if (!session) return res.status(404).json({ success: false, message: 'Invalid session code. Please verify the code and try again.' });

        if (!session.teachers.includes(req.user._id)) {
            session.teachers.push(req.user._id);
            await session.save();
        }

        res.status(200).json({ success: true, message: 'Session claimed successfully!', data: session });
    } catch (error) {
        next(error);
    }
};
