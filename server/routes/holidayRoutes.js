const express = require('express');
const router = express.Router();
const { getAllHolidays, createHoliday, deleteHoliday } = require('../controllers/holidayController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.get('/', protect, getAllHolidays); // Accessible by all authenticated users
router.post('/', protect, authorize('admin'), createHoliday); // Admin only
router.delete('/:id', protect, authorize('admin'), deleteHoliday); // Admin only

module.exports = router;
