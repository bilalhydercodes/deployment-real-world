const User = require('../models/User');
const Session = require('../models/Session');
const generateUniqueCode = require('../utils/generateInviteCode');
const { isValidPassword, passwordRules } = require('../utils/validators');

const createStudent = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !password)
            return res.status(400).json({ success: false, message: 'Name and initial password are required' });
        if (!isValidPassword(password))
            return res.status(400).json({ success: false, message: passwordRules });

        const inviteCode = await generateUniqueCode();
        const student = await User.create({
            name, email: email || undefined, password, role: 'student',
            inviteCode, createdBy: req.user._id, schoolId: req.user.schoolId,
        });

        res.status(201).json({ success: true, message: 'Student created successfully', data: { _id: student._id, name: student.name, inviteCode: student.inviteCode } });
    } catch (error) {
        next(error);
    }
};

const createTeacher = async (req, res, next) => {
    try {
        const { name, email, password, mobile, sessionId } = req.body;
        if (!name || !password)
            return res.status(400).json({ success: false, message: 'Name and initial password are required' });
        if (!isValidPassword(password))
            return res.status(400).json({ success: false, message: passwordRules });

        const inviteCode = await generateUniqueCode('TCH', 'User', 'inviteCode');
        const teacher = await User.create({
            name, email: email || undefined, mobile: mobile || undefined,
            classTeacherOf: sessionId || undefined, password, role: 'teacher',
            inviteCode, createdBy: req.user._id, schoolId: req.user.schoolId,
        });

        res.status(201).json({ success: true, message: 'Teacher created successfully', data: { _id: teacher._id, name: teacher.name, inviteCode: teacher.inviteCode } });
    } catch (error) {
        next(error);
    }
};

const getAllTeachers = async (req, res, next) => {
    try {
        const teachers = await User.find({ role: 'teacher', schoolId: req.user.schoolId })
            .populate('classTeacherOf', 'name')
            .select('-password');
        res.json({ success: true, data: teachers });
    } catch (error) {
        next(error);
    }
};

const deleteTeacher = async (req, res, next) => {
    try {
        const teacher = await User.findOneAndDelete({ _id: req.params.id, role: 'teacher', schoolId: req.user.schoolId });
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
        res.json({ success: true, message: 'Teacher deleted successfully' });
    } catch (error) {
        next(error);
    }
};

const updateTeacher = async (req, res, next) => {
    try {
        const { name, email, mobile, sessionId } = req.body;
        const teacher = await User.findOne({ _id: req.params.id, role: 'teacher', schoolId: req.user.schoolId });
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

        if (name) teacher.name = name;
        if (email !== undefined) teacher.email = email || undefined;
        if (mobile !== undefined) teacher.mobile = mobile || undefined;
        if (sessionId !== undefined) teacher.classTeacherOf = sessionId || undefined;
        await teacher.save();

        const updated = await User.findById(teacher._id).populate('classTeacherOf', 'name').select('-password');
        res.json({ success: true, message: 'Teacher updated successfully', data: updated });
    } catch (error) {
        next(error);
    }
};

const bulkCreateStudents = async (req, res, next) => {
    try {
        const { students, sessionId } = req.body;
        if (!students || !Array.isArray(students) || students.length === 0)
            return res.status(400).json({ success: false, message: 'Please provide an array of students' });

        const createdStudents = [];
        const skippedStudents = [];
        for (const stu of students) {
            if (!stu.name || !stu.password) continue;
            if (!isValidPassword(stu.password)) {
                skippedStudents.push({ name: stu.name, reason: 'Invalid password: ' + passwordRules });
                continue;
            }
            const inviteCode = await generateUniqueCode('STU', 'User', 'inviteCode');
            const newStudent = await User.create({
                name: stu.name, email: stu.email || undefined, password: stu.password,
                role: 'student', inviteCode, createdBy: req.user._id, schoolId: req.user.schoolId,
            });
            createdStudents.push(newStudent);
        }

        if (sessionId && createdStudents.length > 0) {
            const session = await Session.findOne({ _id: sessionId, schoolId: req.user.schoolId });
            if (session) {
                const combined = new Set([...session.students.map(id => id.toString()), ...createdStudents.map(s => s._id.toString())]);
                session.students = Array.from(combined);
                await session.save();
            }
        }

        res.status(201).json({
            success: true,
            count: createdStudents.length,
            skipped: skippedStudents.length,
            skippedDetails: skippedStudents,
            data: createdStudents.map(s => ({ name: s.name, email: s.email, inviteCode: s.inviteCode })),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createStudent,
    createTeacher,
    getAllTeachers,
    deleteTeacher,
    updateTeacher,
    bulkCreateStudents,
};
