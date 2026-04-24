const ROLE_PERMISSIONS = {
    admin: [
        'students.read',
        'students.lock',
        'users.password.reset',
        'teachers.manage',
        'sessions.read',
        'security.otp.manage',
        'profile.update',
    ],
    teacher: [
        'students.read',
        'profile.update',
    ],
    student: [
        'profile.update',
    ],
};

function getPermissionsForRole(role) {
    return ROLE_PERMISSIONS[String(role || '').toLowerCase().trim()] || [];
}

module.exports = { ROLE_PERMISSIONS, getPermissionsForRole };
