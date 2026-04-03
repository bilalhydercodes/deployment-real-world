// User model — admin, teacher, student accounts
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: [true, 'Name is required'], trim: true },
        email: {
            type: String,
            unique: true,
            sparse: true,   // students may not have email
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: [true, 'Password is required'], minlength: 6 },
        role: {
            type: String,
            enum: ['admin', 'teacher', 'student'],
            default: 'student',
        },
        inviteCode: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true,
            trim: true,
        },
        mobile: { type: String, trim: true },
        // lock student out if fees unpaid
        isLocked: { type: Boolean, default: false },
        classTeacherOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
        createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        // brute-force protection
        loginAttempts: { type: Number, default: 0 },
        lockUntil:     { type: Date, default: null },
    },
    { timestamps: true }
);

// ── Indexes for high-traffic queries ─────────────────────────────────────────
// email & inviteCode already have unique indexes via schema definition
userSchema.index({ role: 1 });                  // filter by role (students/teachers)
userSchema.index({ role: 1, createdAt: -1 });   // paginated list sorted by newest
userSchema.index({ name: 'text' });             // full-text search on name

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
