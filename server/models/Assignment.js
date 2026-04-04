const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note:        { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
});

const assignmentSchema = new mongoose.Schema(
    {
        schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        title:       { type: String, required: [true, 'Assignment title is required'], trim: true, maxlength: [200, 'Title too long'] },
        description: { type: String, trim: true },
        subject:     { type: String, required: [true, 'Subject is required'], trim: true },
        dueDate:     { type: Date, required: [true, 'Due date is required'] },
        sessionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: [true, 'Session is required'] },
        createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        submissions: [submissionSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Assignment', assignmentSchema);
