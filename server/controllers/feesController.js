// Fees Controller
const Fees = require('../models/Fees');
const User = require('../models/User');

const getPagination = (query) => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(100, parseInt(query.limit) || 50);
    return { page, limit, skip: (page - 1) * limit };
};

/**
 * @desc    Add a fee record — Admin
 * @route   POST /api/fees/add
 * @access  Private/Admin
 */
const addFee = async (req, res, next) => {
    try {
        const { studentId, feeType, amount, dueDate, description } = req.body;
        if (!studentId || !amount || !dueDate) {
            return res.status(400).json({ success: false, message: 'studentId, amount, and dueDate are required' });
        }

        const student = await User.findById(studentId).select('_id role');
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const fee = await Fees.create({ studentId, feeType: feeType || 'tuition', amount, dueDate, description, status: 'pending' });
        await fee.populate('studentId', 'name');

        res.status(201).json({ success: true, message: 'Fee record created', data: fee });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Mark fee as paid — Admin
 * @route   POST /api/fees/pay
 * @access  Private/Admin
 */
const payFee = async (req, res, next) => {
    try {
        const { feeId } = req.body;
        if (!feeId) return res.status(400).json({ success: false, message: 'feeId is required' });

        const fee = await Fees.findById(feeId);
        if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
        if (fee.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

        fee.status = 'paid';
        fee.paymentDate = new Date();
        await fee.save();

        res.json({ success: true, message: 'Fee marked as paid', data: fee });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get fees for a student (paginated)
 * @route   GET /api/fees/:studentId?page=1&limit=50
 * @access  Private
 */
const getFees = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Bulk-update overdue fees efficiently using index
        await Fees.updateMany(
            { studentId, status: 'pending', dueDate: { $lt: new Date() } },
            { $set: { status: 'overdue' } }
        );

        const { page, limit, skip } = getPagination(req.query);

        const [fees, total] = await Promise.all([
            Fees.find({ studentId })
                .select('feeType amount status dueDate paymentDate description')
                .sort({ dueDate: -1 })
                .skip(skip)
                .limit(limit),
            Fees.countDocuments({ studentId }),
        ]);

        // Summary across all records
        const allFees = await Fees.find({ studentId }).select('amount status');
        const totalAmt   = allFees.reduce((s, f) => s + f.amount, 0);
        const paidAmt    = allFees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
        const pendingAmt = allFees.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0);

        res.json({
            success: true,
            data: fees,
            summary: { total: totalAmt, paid: paidAmt, pending: pendingAmt },
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all fees — Admin (paginated)
 * @route   GET /api/fees?page=1&limit=50&status=pending
 * @access  Private/Admin
 */
const getAllFees = async (req, res, next) => {
    try {
        // Update overdue globally
        await Fees.updateMany(
            { status: 'pending', dueDate: { $lt: new Date() } },
            { $set: { status: 'overdue' } }
        );

        const { page, limit, skip } = getPagination(req.query);
        const filter = req.query.status ? { status: req.query.status } : {};

        const [fees, total] = await Promise.all([
            Fees.find(filter)
                .select('studentId feeType amount status dueDate paymentDate')
                .populate('studentId', 'name inviteCode')
                .sort({ dueDate: -1 })
                .skip(skip)
                .limit(limit),
            Fees.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: fees,
            pagination: { page, limit, totalPages: Math.ceil(total / limit), totalRecords: total },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { addFee, payFee, getFees, getAllFees };
