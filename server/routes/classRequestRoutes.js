const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { createRequest, getMyRequests, getAllRequests, reviewRequest } = require('../controllers/classRequestController');

router.post('/',           protect, authorize('teacher'), createRequest);
router.get('/my',          protect, authorize('teacher'), getMyRequests);
router.get('/',            protect, authorize('admin'),   getAllRequests);
router.patch('/:id',       protect, authorize('admin'),   reviewRequest);

module.exports = router;
