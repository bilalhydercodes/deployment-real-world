const express = require('express');
const router = express.Router();
const { applyLeave, getMyLeaves, getAllLeaves, updateLeaveStatus } = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/apply', protect, authorize('student'), applyLeave);
router.get('/my', protect, authorize('student'), getMyLeaves);
router.get('/', protect, authorize('admin', 'teacher'), getAllLeaves);
router.patch('/:id/status', protect, authorize('admin', 'teacher'), updateLeaveStatus);

module.exports = router;
