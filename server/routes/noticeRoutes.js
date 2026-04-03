const express = require('express');
const router = express.Router();
const { createNotice, getNotices, deleteNotice } = require('../controllers/noticeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, getNotices);
router.post('/', protect, authorize('admin', 'teacher'), createNotice);
router.delete('/:id', protect, authorize('admin', 'teacher'), deleteNotice);

module.exports = router;
