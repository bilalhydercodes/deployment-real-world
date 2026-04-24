const express = require('express');
const router = express.Router();
const { createSession, addStudentsToSession, getSessions, claimSession } = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

// Admin & Teacher Routes
router.post('/create', authorize('admin'), createSession);
router.post('/add-students', authorize('admin'), addStudentsToSession);
router.get('/', authorize('admin', 'teacher', 'student'), getSessions);

// Teacher Routes
router.post('/claim', authorize('teacher'), claimSession);

module.exports = router;
