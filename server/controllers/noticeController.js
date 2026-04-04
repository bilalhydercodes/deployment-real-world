const Notice = require('../models/Notice');

const createNotice = async (req, res, next) => {
    try {
        const { title, body, audience } = req.body;
        if (!title || !body)
            return res.status(400).json({ success: false, message: 'Title and body are required' });
        const notice = await Notice.create({ schoolId: req.user.schoolId, title, body, audience, postedBy: req.user._id });
        await notice.populate('postedBy', 'name role');
        res.status(201).json({ success: true, data: notice });
    } catch (err) { next(err); }
};

const getNotices = async (req, res, next) => {
    try {
        const notices = await Notice.find({ schoolId: req.user.schoolId })
            .populate('postedBy', 'name role')
            .sort('-createdAt')
            .limit(50);
        res.json({ success: true, data: notices });
    } catch (err) { next(err); }
};

const deleteNotice = async (req, res, next) => {
    try {
        const notice = await Notice.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
        if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
        if (req.user.role !== 'admin' && String(notice.postedBy) !== String(req.user._id))
            return res.status(403).json({ success: false, message: 'Not authorized' });
        await notice.deleteOne();
        res.json({ success: true, message: 'Notice deleted' });
    } catch (err) { next(err); }
};

module.exports = { createNotice, getNotices, deleteNotice };
