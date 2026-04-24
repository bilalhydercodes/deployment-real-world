// Discipline routes
const express = require('express');
const router = express.Router();
const {
    reportDiscipline,
    getAllDiscipline,
    getStudentDiscipline,
    takeAction,
} = require('../controllers/disciplineController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

// Teacher/Admin: report a case
router.post('/report', authorize('teacher', 'admin'), reportDiscipline);

// Admin: all cases; Teacher: own reports
router.get('/', authorize('admin', 'teacher'), getAllDiscipline);

// View by student (student sees own, teacher/admin see all)
router.get('/student/:studentId', getStudentDiscipline);

// Admin: take action on a case
router.patch('/:id/action', authorize('admin'), takeAction);

module.exports = router;
