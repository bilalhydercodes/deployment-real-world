const express = require('express');
const router = express.Router();
const { addEntry, getBySession, deleteEntry } = require('../controllers/timetableController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/:sessionId', protect, getBySession);
router.post('/', protect, authorize('admin', 'teacher'), addEntry);
router.delete('/:id', protect, authorize('admin'), deleteEntry);

module.exports = router;
