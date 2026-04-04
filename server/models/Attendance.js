// Attendance model — student attendance records
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        subject:   { type: String, required: true, trim: true },
        date:      { type: Date, required: true, default: Date.now },
        status:    { type: String, enum: ['present', 'absent', 'late'], required: true },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
attendanceSchema.index({ studentId: 1, date: -1 });         // student history (most common query)
attendanceSchema.index({ studentId: 1, subject: 1 });       // per-subject attendance
attendanceSchema.index({ markedBy: 1, date: -1 });          // teacher's records
attendanceSchema.index({ date: -1 });                       // admin: all records by date

module.exports = mongoose.model('Attendance', attendanceSchema);
