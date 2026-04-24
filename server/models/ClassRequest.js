// ClassRequest model — teacher requests an extra/different class slot
// Admin reviews and approves/rejects
const mongoose = require('mongoose');

const classRequestSchema = new mongoose.Schema(
    {
        schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        teacher:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        sessionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
        dayOfWeek:  { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], required: true },
        subject:    { type: String, required: true, trim: true },
        startTime:  { type: String, required: true },
        endTime:    { type: String, required: true },
        reason:     { type: String, trim: true, maxlength: 500 },
        status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewNote: { type: String, trim: true },
    },
    { timestamps: true }
);

classRequestSchema.index({ teacher: 1, createdAt: -1 });
classRequestSchema.index({ schoolId: 1, status: 1 });

module.exports = mongoose.model('ClassRequest', classRequestSchema);
