const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema(
    {
        schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: [true, 'Session is required'] },
        dayOfWeek: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: [true, 'Day of week is required'] },
        subject:   { type: String, required: [true, 'Subject is required'], trim: true, maxlength: [100, 'Subject name too long'] },
        startTime: { type: String, required: [true, 'Start time is required'] },
        endTime:   { type: String, required: [true, 'End time is required'] },
        teacher:   { type: String, trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Timetable', timetableSchema);
