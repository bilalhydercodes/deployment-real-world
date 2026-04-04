// Session model — class/batch grouping
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
    {
        schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name:        { type: String, required: true, trim: true },
        sessionCode: { type: String, unique: true, required: true, uppercase: true, trim: true },
        students:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        teachers:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// sessionCode already has unique index
sessionSchema.index({ teachers: 1 });   // find sessions by teacher
sessionSchema.index({ students: 1 });   // find sessions by student

module.exports = mongoose.model('Session', sessionSchema);
