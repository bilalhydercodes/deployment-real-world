'use strict';

const mongoose = require('mongoose');

async function connectToDatabase() {
    const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
        console.error('❌ MongoDB URI is missing. Set MONGO_URI or DATABASE_URL.');
        return; // Don't crash — let server start, API will return 503
    }

    const connect = async (attempt = 1) => {
        try {
            await mongoose.connect(uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
            });
            console.log('✅ MongoDB connected successfully');

            // Keep-alive ping every 4 min — prevents Atlas free tier from sleeping
            setInterval(async () => {
                try { await mongoose.connection.db.admin().ping(); }
                catch (e) { console.warn('[DB] Keep-alive ping failed:', e.message); }
            }, 4 * 60 * 1000);

        } catch (err) {
            console.error(`❌ DB connection attempt ${attempt} failed: ${err.message}`);
            if (attempt < 5) {
                const delay = attempt * 3000; // 3s, 6s, 9s, 12s
                console.log(`Retrying in ${delay / 1000}s...`);
                setTimeout(() => connect(attempt + 1), delay);
            } else {
                console.error('❌ Could not connect to MongoDB after 5 attempts.');
            }
        }
    };

    connect();
}

module.exports = connectToDatabase;
