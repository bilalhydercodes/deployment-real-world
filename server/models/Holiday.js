const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
    {
        schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
        name: { type: String, required: true, trim: true },
        date: { type: Date, required: true },
        type: { type: String, enum: ['public', 'school', 'exam'], default: 'public' }
    },
    { timestamps: true }
);

holidaySchema.index({ schoolId: 1, date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
