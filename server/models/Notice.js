// Notice model — announcements from admin/teacher
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
    {
        schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title:    { type: String, required: true, trim: true, maxlength: 150 },
        body:     { type: String, required: true, trim: true },
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        audience: { type: String, enum: ['all', 'students', 'teachers'], default: 'all' },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
noticeSchema.index({ audience: 1, createdAt: -1 });     // filter by audience, newest first
noticeSchema.index({ postedBy: 1 });                    // teacher's own notices

module.exports = mongoose.model('Notice', noticeSchema);
