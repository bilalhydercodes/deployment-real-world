// LeaveRequest model — student leave applications
const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
    {
        schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
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

leaveRequestSchema.index({ student: 1, createdAt: -1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
