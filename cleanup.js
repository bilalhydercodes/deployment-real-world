// cleanup.js — removes all load test data, keeps real admin
const mongoose = require('mongoose');
require('dotenv').config();
const User       = require('./server/models/User');
const Session    = require('./server/models/Session');
const Attendance = require('./server/models/Attendance');
const Marks      = require('./server/models/Marks');
const Fees       = require('./server/models/Fees');
const Discipline = require('./server/models/Discipline');

async function cleanup() {
    await mongoose.connect(process.env.MONGO_URI || process.env.DATABASE_URL);
    console.log('Connected.');

    // Delete all load test students & teachers (name starts with "Load Test")
    const testUsers = await User.find({ name: /^Load Test/i }).select('_id');
    const testIds   = testUsers.map(u => u._id);
    console.log(`Found ${testIds.length} load test users`);

    // Delete their related data
    const [a, m, f, d] = await Promise.all([
        Attendance.deleteMany({ studentId: { $in: testIds } }),
        Marks.deleteMany({ studentId: { $in: testIds } }),
        Fees.deleteMany({ studentId: { $in: testIds } }),
        Discipline.deleteMany({ student: { $in: testIds } }),
    ]);
    console.log(`Deleted: ${a.deletedCount} attendance, ${m.deletedCount} marks, ${f.deletedCount} fees, ${d.deletedCount} discipline`);

    // Delete load test sessions
    const sessions = await Session.deleteMany({ name: /^Load Test Session/i });
    console.log(`Deleted ${sessions.deletedCount} sessions`);

    // Delete load test users
    const users = await User.deleteMany({ name: /^Load Test/i });
    console.log(`Deleted ${users.deletedCount} users`);

    // Show what's left
    const remaining = await User.countDocuments();
    console.log(`\n✅ Done. ${remaining} user(s) remaining in DB.`);

    await mongoose.disconnect();
}

cleanup().catch(console.error);
