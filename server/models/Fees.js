// Fees model — student fee records and payments
const mongoose = require('mongoose');

const feesSchema = new mongoose.Schema(
    {
        studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        feeType:     { type: String, enum: ['tuition', 'hostel', 'library', 'examination', 'other'], default: 'tuition' },
        amount:      { type: Number, required: true, min: 0 },
        status:      { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
        dueDate:     { type: Date, required: true },
        paymentDate: { type: Date },
        description: { type: String, trim: true },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
feesSchema.index({ studentId: 1, status: 1 });      // student fee status lookup
feesSchema.index({ studentId: 1, dueDate: -1 });    // overdue check
feesSchema.index({ status: 1, dueDate: 1 });        // admin: all overdue fees

module.exports = mongoose.model('Fees', feesSchema);
