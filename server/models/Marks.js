// Marks model — student exam/assignment grades
const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema(
    {
        schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        enteredBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        subject:    { type: String, required: true, trim: true },
        examType:   { type: String, enum: ['midterm', 'final', 'assignment', 'quiz'], default: 'midterm' },
        marks:      { type: Number, required: true, min: 0 },
        totalMarks: { type: Number, default: 100 },
        grade:      { type: String, trim: true },
    },
    { timestamps: true }
);

marksSchema.index({ studentId: 1, createdAt: -1 });
marksSchema.index({ studentId: 1, subject: 1, examType: 1 });
marksSchema.index({ enteredBy: 1 });

marksSchema.pre('save', function (next) {
    const pct = (this.marks / this.totalMarks) * 100;
    if (pct >= 90)      this.grade = 'A+';
    else if (pct >= 80) this.grade = 'A';
    else if (pct >= 70) this.grade = 'B';
    else if (pct >= 60) this.grade = 'C';
    else if (pct >= 50) this.grade = 'D';
    else                this.grade = 'F';
    next();
});

module.exports = mongoose.model('Marks', marksSchema);
