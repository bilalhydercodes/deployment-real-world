const crypto = require('crypto');

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { hashValue };
