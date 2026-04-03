'use strict';

const mongoose = require('mongoose');

async function connectToDatabase() {
    try {
        const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
        if (!uri) throw new Error('MongoDB URI is missing. Set MONGO_URI in your .env file.');

        await mongoose.connect(uri, {
            maxPoolSize: 10,        // keep up to 10 connections ready
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ MongoDB connected successfully');

        // Keep-alive ping every 4 minutes — prevents Atlas free tier from sleeping
        setInterval(async () => {
            try {
                await mongoose.connection.db.admin().ping();
            } catch (e) {
                console.warn('[DB] Keep-alive ping failed:', e.message);
            }
        }, 4 * 60 * 1000);

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        process.exit(1);
    }
}

module.exports = connectToDatabase;
