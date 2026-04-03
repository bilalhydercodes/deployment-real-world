// utils/generateInviteCode.js
// ─────────────────────────────────────────────────────────────────────────────
// Generates a unique 8-character invite code (e.g. STU-1A2B3C or SES-XYZ123)
// Checks the provided model in DB to ensure no collisions
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

const generateUniqueCode = async (prefix = 'STU', modelName = 'User', fieldName = 'inviteCode') => {
    let isUnique = false;
    let code = '';
    const Model = mongoose.model(modelName);

    while (!isUnique) {
        // Generate random 6 character string (alphanumeric, uppercase)
        const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
        code = `${prefix}-${randomChars}`;

        // Check if code exists
        const existing = await Model.findOne({ [fieldName]: code });
        if (!existing) {
            isUnique = true;
        }
    }

    return code;
};

module.exports = generateUniqueCode;
