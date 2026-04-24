const express = require('express');
const router = express.Router();
const { createAssignment, getBySession, getMyAssignments, submitAssignment } = require('../controllers/assignmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, authorize('admin', 'teacher'), getMyAssignments);
router.post('/', protect, authorize('admin', 'teacher'), createAssignment);
router.get('/session/:sessionId', protect, getBySession);
router.post('/:id/submit', protect, authorize('student'), submitAssignment);

module.exports = router;
