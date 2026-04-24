const Holiday = require('../models/Holiday');

const getAllHolidays = async (req, res, next) => {
    try {
        const holidays = await Holiday.find({ schoolId: req.user.schoolId }).sort('date');
        res.json({ success: true, data: holidays });
    } catch (err) { next(err); }
};

const createHoliday = async (req, res, next) => {
    try {
        const { name, date, type } = req.body;
        if (!name || !date) {
            return res.status(400).json({ success: false, message: 'Name and date are required' });
        }
        
        const holiday = await Holiday.create({
            schoolId: req.user.schoolId,
            name: name.trim(),
            date,
            type: type || 'public'
        });
        
        res.status(201).json({ success: true, message: 'Holiday added successfully', data: holiday });
    } catch (err) { next(err); }
};

const deleteHoliday = async (req, res, next) => {
    try {
        const holiday = await Holiday.findOneAndDelete({ _id: req.params.id, schoolId: req.user.schoolId });
        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }
        res.json({ success: true, message: 'Holiday deleted successfully' });
    } catch (err) { next(err); }
};

module.exports = { getAllHolidays, createHoliday, deleteHoliday };
