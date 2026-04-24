const mongoose = require('mongoose');
const http = require('http');

require('dotenv').config();
require('./server/models/User');

const User = mongoose.model('User');
const SERVER_URL = 'http://localhost:5000/api/auth/student-login';

function makeRequest(postData) {
    return new Promise((resolve) => {
        const url = new URL(SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'x-load-test': process.env.LOAD_TEST_SECRET || 'load-test-bypass-key'
            }
        };

        const startTime = Date.now();
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const latency = Date.now() - startTime;
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, latency, status: res.statusCode });
                } else {
                    resolve({ success: false, latency, status: res.statusCode, error: data });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, latency: Date.now() - startTime, status: 0, error: e.message });
        });

        req.write(postData);
        req.end();
    });
}

async function runLoadTest() {
    try {
        console.log('Fetching 800 student credentials from DB...');
        await mongoose.connect(process.env.MONGO_URI);
        const students = await User.find({ role: 'student' }).limit(800).select('inviteCode').lean();
        await mongoose.disconnect();

        if (students.length === 0) {
            console.log('No students found to test with! Run: node seed-load.js first');
            process.exit(1);
        }

        console.log(`Found ${students.length} students in DB.`);
        console.log(`Simulating ${students.length} students logging in AT THE EXACT SAME TIME...`);
        console.log(`Target: ${SERVER_URL}`);
        console.log('GO!\n');

        const startTime = Date.now();
        
        const requestPromises = students.map(student => {
            const postData = JSON.stringify({ inviteCode: student.inviteCode, password: 'password123' });
            return makeRequest(postData);
        });

        const results = await Promise.all(requestPromises);
        const totalDuration = Date.now() - startTime;

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const rateLimited = results.filter(r => r.status === 429);
        const latencies = results.map(r => r.latency).sort((a, b) => a - b);
        
        const minLatency = latencies[0];
        const maxLatency = latencies[latencies.length - 1];
        const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const p99 = latencies[Math.floor(latencies.length * 0.99)];

        console.log('=========================================');
        console.log('🚦 LOAD TEST RESULTS — 800 Students');
        console.log('=========================================');
        console.log(`Total Requests:      ${results.length}`);
        console.log(`Successful (200 OK): ${successful.length} ✅`);
        console.log(`Failed / Errors:     ${failed.length - rateLimited.length} ❌`);
        console.log(`Rate Limited (429):  ${rateLimited.length} 🚫`);
        console.log(`Total Time Taken:    ${(totalDuration / 1000).toFixed(2)} seconds`);
        console.log('-----------------------------------------');
        console.log(`Avg Response Time:   ${avgLatency} ms`);
        console.log(`P95 Response Time:   ${p95} ms`);
        console.log(`P99 Response Time:   ${p99} ms`);
        console.log(`Slowest Response:    ${maxLatency} ms`);
        console.log(`Fastest Response:    ${minLatency} ms`);
        console.log('=========================================');

        // Verdict
        const successRate = (successful.length / results.length) * 100;
        console.log(`\n📊 Success Rate: ${successRate.toFixed(1)}%`);
        if (successRate >= 95) {
            console.log('✅ VERDICT: System handles 800 concurrent students WELL');
        } else if (successRate >= 80) {
            console.log('⚠️  VERDICT: System handles 800 students but with some failures — consider scaling');
        } else {
            console.log('❌ VERDICT: System struggles under 800 concurrent users — needs optimization');
        }

        if (rateLimited.length > 0) {
            console.log(`\nℹ️  Note: ${rateLimited.length} requests were rate-limited (429). This is expected`);
            console.log('   behavior from the same IP. In production, students come from different IPs.');
        }

        if (failed.length > 0 && failed[0].error) {
            console.log('\nSample Error:');
            console.log(failed[0].error?.substring(0, 200));
        }

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

runLoadTest();
