// Discipline model — student misconduct reports
const mongoose = require('mongoose');

const disciplineSchema = new mongoose.Schema(
    {
         // Discipline model — student misconduct reports
const mongoose = require('mongoose');

const disciplineSchema = new mongoose.Schema(
    {
        schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason:     { type: String, required: true, trim: true, maxlength: 1000 },
        severity:   { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        date:       { type: Date, default: Date.now },
        action:     { type: String, enum: ['pending', 'warning', 'suspend', 'notify_parent', 'resolved'], default: 'pending' },
        actionNote: { type: String, trim: true },
        actionBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actionDate: { type: Date },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
disciplineSchema.index({ student: 1, date: -1 });       // student's discipline history
disciplineSchema.index({ reportedBy: 1, date: -1 });    // teacher's reports
disciplineSchema.index({ action: 1 });                  // admin: filter by pending/resolved
disciplineSchema.index({ severity: 1, date: -1 });      // admin: filter by severity

module.exports = mongoose.model('Discipline', disciplineSchema);
.Value -replace 'required:\s*true,\s*', '' ,
        student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason:     { type: String, required: true, trim: true, maxlength: 1000 },
        severity:   { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        date:       { type: Date, default: Date.now },
        action:     { type: String, enum: ['pending', 'warning', 'suspend', 'notify_parent', 'resolved'], default: 'pending' },
        actionNote: { type: String, trim: true },
        actionBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actionDate: { type: Date },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
disciplineSchema.index({ student: 1, date: -1 });       // student's discipline history
disciplineSchema.index({ reportedBy: 1, date: -1 });    // teacher's reports
disciplineSchema.index({ action: 1 });                  // admin: filter by pending/resolved
disciplineSchema.index({ severity: 1, date: -1 });      // admin: filter by severity

module.exports = mongoose.model('Discipline', disciplineSchema);

