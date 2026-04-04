// User model — admin, teacher, student accounts
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'Name is required'], trim: true },
        email: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: [true, 'Password is required'], minlength: 6 },
        role: {
            type: String,
            enum: ['admin', 'teacher', 'student'],
            default: 'student',
        },
        // schoolId — the admin's _id. All users/data in a school share this value.
        schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        inviteCode: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true,
            trim: true,
        },
        mobile: { type: String, trim: true },
        isLocked: { type: Boolean, default: false },
        classTeacherOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
        createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        loginAttempts: { type: Number, default: 0 },
        lockUntil:     { type: Date, default: null },
    },
    { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ schoolId: 1, role: 1 });
userSchema.index({ name: 'text' });

// ── Password hashing ──────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
