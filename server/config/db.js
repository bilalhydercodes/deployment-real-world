'use strict';

const mongoose = require('mongoose');

async function connectToDatabase() {
    try {
        // Support both MONGO_URI (new) and DATABASE_URL (legacy)
        const uri = process.env.MONGO_URI || process.env.DATABASE_URL;

        if (!uri) {
            throw new Error('MongoDB URI is missing. Set MONGO_URI in your .env file.');
        }

        await mongoose.connect(uri);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        process.exit(1);
    }
}

module.exports = connectToDatabase;
