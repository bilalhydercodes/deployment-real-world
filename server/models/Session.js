// Session model — class/batch grouping
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
    {
        schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        name:        { type: String, required: true, trim: true },
        sessionCode: { type: String, unique: true, required: true, uppercase: true, trim: true },
        students:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        teachers:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

sessionSchema.index({ teachers: 1 });
sessionSchema.index({ students: 1 });

module.exports = mongoose.model('Session', sessionSchema);
