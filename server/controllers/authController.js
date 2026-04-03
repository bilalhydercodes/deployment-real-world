// Auth Controller
const User = require('../models/User');
const Session = require('../models/Session');
const generateToken = require('../utils/generateToken');
const { isValidEmail, isValidPassword, isValidRole, passwordRules } = require('../utils/validators');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS   = 15 * 60 * 1000; // 15 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

async function handleFailedLogin(user) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }
    await user.save();
}

async function handleSuccessfulLogin(user) {
    if (user.loginAttempts > 0 || user.lockUntil) {
        user.loginAttempts = 0;
        user.lockUntil = null;
        await user.save();
    }
}

function isAccountLocked(user) {
    return user.lockUntil && user.lockUntil > new Date();
}

function lockMessage(user) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return `Account temporarily locked due to too many failed attempts. Try again in ${mins} minute(s).`;
}

// ── Register (Admin only — one admin per system) ──────────────────────────────
/**
 * @route  POST /api/auth/register
 * @access Public
 * @desc   Only allows registering the FIRST admin account.
 *         Teachers are created by admin from the admin panel.
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
        }
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: passwordRules });
        }

        // Only allow admin registration — teachers are created by admin
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            return res.status(403).json({
                success: false,
                message: 'An admin account already exists. Teachers are added by the admin from the admin panel.',
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const user = await User.create({ name, email, password, role: 'admin' });
        const token = generateToken(user._id, user.role);

        console.log(`[REGISTER] Admin account created: ${user.email}`);

        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            data: { _id: user._id, name: user.name, email: user.email, role: user.role, token },
        });
    } catch (error) {
        next(error);
    }
};

// ── Login (Admin / Teacher via email+password) ────────────────────────────────
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Generic message — don't reveal if email exists
        const invalidMsg = 'Invalid email or password';

        if (!user) {
            return res.status(401).json({ success: false, message: invalidMsg });
        }

        // Check brute-force lock
        if (isAccountLocked(user)) {
            return res.status(429).json({ success: false, message: lockMessage(user) });
        }

        if (user.role === 'student') {
            return res.status(401).json({ success: false, message: 'Students must login via the Student Portal using an Invite Code.' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            await handleFailedLogin(user);
            const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
            const msg = attemptsLeft <= 0
                ? lockMessage(user)
                : `${invalidMsg}. ${attemptsLeft} attempt(s) remaining before lockout.`;
            return res.status(401).json({ success: false, message: msg });
        }

        await handleSuccessfulLogin(user);
        const token = generateToken(user._id, user.role);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { _id: user._id, name: user.name, email: user.email, role: user.role, token },
        });
    } catch (error) {
        next(error);
    }
};

// ── Student Login (invite code + password) ────────────────────────────────────
const studentLogin = async (req, res, next) => {
    try {
        const { inviteCode, password } = req.body;

        if (!inviteCode || !password) {
            return res.status(400).json({ success: false, message: 'Please provide Invite Code and password' });
        }

        const student = await User.findOne({ inviteCode: inviteCode.toUpperCase(), role: 'student' });
        const invalidMsg = 'Invalid Invite Code or password';

        if (!student) {
            return res.status(401).json({ success: false, message: invalidMsg });
        }

        if (isAccountLocked(student)) {
            return res.status(429).json({ success: false, message: lockMessage(student) });
        }

        if (student.isLocked) {
            return res.status(403).json({ success: false, message: 'Your account is locked. Please contact the admin.' });
        }

        const isMatch = await student.matchPassword(password);
        if (!isMatch) {
            await handleFailedLogin(student);
            const attemptsLeft = MAX_LOGIN_ATTEMPTS - student.loginAttempts;
            const msg = attemptsLeft <= 0
                ? lockMessage(student)
                : `${invalidMsg}. ${attemptsLeft} attempt(s) remaining before lockout.`;
            return res.status(401).json({ success: false, message: msg });
        }

        await handleSuccessfulLogin(student);
        const token = generateToken(student._id, student.role);

        res.status(200).json({
            success: true,
            message: 'Student login successful',
            data: { _id: student._id, name: student.name, role: student.role, inviteCode: student.inviteCode, token },
        });
    } catch (error) {
        next(error);
    }
};

// ── Teacher Login (invite code + password) ────────────────────────────────────
const teacherLogin = async (req, res, next) => {
    try {
        const { inviteCode, password } = req.body;

        if (!inviteCode || !password) {
            return res.status(400).json({ success: false, message: 'Please provide Teacher Code and password' });
        }

        const teacher = await User.findOne({ inviteCode: inviteCode.toUpperCase(), role: 'teacher' });
        const invalidMsg = 'Invalid Teacher Code or password';

        if (!teacher) {
            return res.status(401).json({ success: false, message: invalidMsg });
        }

        if (isAccountLocked(teacher)) {
            return res.status(429).json({ success: false, message: lockMessage(teacher) });
        }

        const isMatch = await teacher.matchPassword(password);
        if (!isMatch) {
            await handleFailedLogin(teacher);
            const attemptsLeft = MAX_LOGIN_ATTEMPTS - teacher.loginAttempts;
            const msg = attemptsLeft <= 0
                ? lockMessage(teacher)
                : `${invalidMsg}. ${attemptsLeft} attempt(s) remaining before lockout.`;
            return res.status(401).json({ success: false, message: msg });
        }

        await handleSuccessfulLogin(teacher);
        const token = generateToken(teacher._id, teacher.role);

        res.status(200).json({
            success: true,
            message: 'Teacher login successful',
            data: { _id: teacher._id, name: teacher.name, email: teacher.email, role: teacher.role, inviteCode: teacher.inviteCode, token },
        });
    } catch (error) {
        next(error);
    }
};

// ── Get current user ──────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('classTeacherOf', 'name sessionCode')
            .select('-password -loginAttempts -lockUntil');
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

// ── Get all students ──────────────────────────────────────────────────────────
const getAllStudents = async (req, res, next) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 50);
        const skip  = (page - 1) * limit;

        const searchFilter = req.query.search
            ? { name: { $regex: req.query.search, $options: 'i' } }
            : {};

        let filter = { role: 'student', ...searchFilter };

        if (req.user.role === 'teacher') {
            const orConditions = [{ teachers: req.user._id }];
            if (req.user.classTeacherOf) orConditions.push({ _id: req.user.classTeacherOf });
            const sessions = await Session.find({ $or: orConditions }).select('students');
            const ids = [...new Set(sessions.flatMap(s => s.students.map(id => id.toString())))];
            filter = { _id: { $in: ids }, role: 'student', ...searchFilter };
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const [students, total] = await Promise.all([
            User.find(filter).select('-password -loginAttempts -lockUntil').sort({ createdAt: -1 }).skip(skip).limit(limit),
            User.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: students,
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

// ── Update profile ────────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (name) user.name = name.trim();
        if (email) {
            if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email format' });
            user.email = email.toLowerCase().trim();
        }
        if (password) {
            if (!isValidPassword(password)) return res.status(400).json({ success: false, message: passwordRules });
            user.password = password;
        }
        await user.save();
        res.json({ success: true, message: 'Profile updated successfully', data: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        next(error);
    }
};

// ── Admin: set password ───────────────────────────────────────────────────────
const adminSetUserPassword = async (req, res, next) => {
    try {
        const { role, newPassword, userId, inviteCode, email } = req.body;

        const normalizedRole = String(role || '').toLowerCase().trim();
        if (!['student', 'teacher'].includes(normalizedRole)) {
            return res.status(400).json({ success: false, message: "Role must be 'student' or 'teacher'" });
        }
        if (!isValidPassword(newPassword)) {
            return res.status(400).json({ success: false, message: passwordRules });
        }

        const query = { role: normalizedRole };
        if (userId) query._id = userId;
        else if (inviteCode) query.inviteCode = String(inviteCode).toUpperCase().trim();
        else if (email) query.email = String(email).toLowerCase().trim();
        else return res.status(400).json({ success: false, message: 'Provide userId, inviteCode, or email' });

        const user = await User.findOne(query);
        if (!user) return res.status(404).json({ success: false, message: `${normalizedRole} not found` });

        user.password = newPassword;
        user.loginAttempts = 0;
        user.lockUntil = null;
        await user.save();

        res.json({ success: true, message: `${normalizedRole} password updated`, data: { _id: user._id, name: user.name, role: user.role } });
    } catch (error) {
        next(error);
    }
};

// ── Admin: lock/unlock student ────────────────────────────────────────────────
async function lockUnlockStudent(req, res, next) {
    try {
        const { studentId, lock } = req.body;
        if (!studentId || lock === undefined) {
            return res.status(400).json({ success: false, message: 'studentId and lock (boolean) are required' });
        }
        const student = await User.findOneAndUpdate(
            { _id: studentId, role: 'student' },
            { isLocked: Boolean(lock) },
            { new: true }
        ).select('name inviteCode isLocked');

        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        res.json({ success: true, message: `Student account ${lock ? 'locked' : 'unlocked'}`, data: student });
    } catch (error) {
        next(error);
    }
}

module.exports = { register, login, teacherLogin, studentLogin, getMe, getAllStudents, updateProfile, adminSetUserPassword, lockUnlockStudent };
