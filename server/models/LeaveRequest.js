// LeaveRequest model — student leave applications
const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
    {
        student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason:     { type: String, required: true, trim: true, maxlength: 500 },
        fromDate:   { type: Date, required: true },
        toDate:     { type: Date, required: true },
        status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewNote: { type: String, trim: true },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
leaveRequestSchema.index({ student: 1, createdAt: -1 });    // student's leave history
leaveRequestSchema.index({ status: 1, createdAt: -1 });     // admin: pending leaves

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
