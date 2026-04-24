// Attendance model — student attendance records
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        subject:   { type: String, required: true, trim: true },
        date:      { type: Date, required: true, default: Date.now },
        status:    { type: String, enum: ['present', 'absent', 'late'], required: true },
    },
    { timestamps: true }
);

attendanceSchema.index({ studentId: 1, date: -1 });
attendanceSchema.index({ studentId: 1, subject: 1 });
attendanceSchema.index({ markedBy: 1, date: -1 });
attendanceSchema.index({ date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
