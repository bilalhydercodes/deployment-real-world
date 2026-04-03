const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./server/models/User');
const Session = require('./server/models/Session');

const generateUniqueCode = async (prefix = 'STU', modelName = 'User', field = 'inviteCode') => {
    let isUnique = false;
    let code = '';
    const Model = mongoose.model(modelName);
    while (!isUnique) {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `${prefix}-${randomStr}`;
        const existing = await Model.findOne({ [field]: code });
        if (!existing) isUnique = true;
    }
    return code;
};

// Batch generate N unique codes at once (much faster)
const generateBulkCodes = async (prefix, count, modelName, field) => {
    const Model = mongoose.model(modelName);
    const codes = new Set();
    while (codes.size < count) {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        codes.add(`${prefix}-${randomStr}`);
    }
    const codeArr = [...codes];
    const existing = await Model.find({ [field]: { $in: codeArr } }).select(field).lean();
    const existingSet = new Set(existing.map(e => e[field]));
    const unique = codeArr.filter(c => !existingSet.has(c));
    // If some collided, top up recursively (very rare)
    if (unique.length < count) {
        const extra = await generateBulkCodes(prefix, count - unique.length, modelName, field);
        return [...unique, ...extra];
    }
    return unique;
};

async function seedDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const admin = await User.findOne({ role: 'admin' });
        if (!admin) throw new Error('No admin user found. Please create one first.');
        const adminId = admin._id;

        // Pre-generate all codes in bulk (2 DB queries instead of 820)
        console.log('Pre-generating unique codes in bulk...');
        const sesCodes   = await generateBulkCodes('SES', 20, 'Session', 'sessionCode');
        const tchCodes   = await generateBulkCodes('TCH', 20, 'User', 'inviteCode');
        const stuCodes   = await generateBulkCodes('STU', 800, 'User', 'inviteCode');
        console.log('Codes generated. Creating sessions and teachers...');

        const sessions = [];
        for (let i = 0; i < 20; i++) {
            const session = await Session.create({
                name: `Load Test Session ${i + 1}`,
                sessionCode: sesCodes[i],
                createdBy: adminId
            });
            sessions.push(session);

            const teacher = await User.create({
                name: `Load Test Teacher ${i + 1}`,
                password: 'password123',
                role: 'teacher',
                inviteCode: tchCodes[i],
                classTeacherOf: session._id,
                createdBy: adminId
            });
            session.teachers.push(teacher._id);
            await session.save();
        }

        console.log('Creating 800 students in bulk batches...');
        const BATCH = 40; // 40 students per session
        let stuIdx = 0;
        for (let sIdx = 0; sIdx < 20; sIdx++) {
            const currentSession = sessions[sIdx];
            const batch = [];
            for (let i = 0; i < BATCH; i++) {
                batch.push({
                    name: `Load Test Student ${stuIdx + 1}`,
                    password: 'password123',
                    role: 'student',
                    inviteCode: stuCodes[stuIdx],
                    createdBy: adminId
                });
                stuIdx++;
            }
            const created = await User.insertMany(batch);
            currentSession.students.push(...created.map(s => s._id));
            await currentSession.save();
            console.log(`Session ${sIdx + 1}/20 done — ${stuIdx} students created`);
        }

        console.log(`\n✅ Database successfully seeded!`);
        console.log(`- Created 20 Sessions`);
        console.log(`- Created 20 Teachers (1 per session)`);
        console.log(`- Created 800 Students (40 per session)`);
        
    } catch (err) {
        console.error('Error during seeding:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
}

seedDatabase();
