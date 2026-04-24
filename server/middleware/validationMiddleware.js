const apiResponse = require('../utils/apiResponse');

const validate = (validator) => {
    return (req, res, next) => {
        const result = validator(req.body || {}, req);
        if (result.valid) return next();
        return apiResponse.failure(res, {
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.errors,
        });
    };
};

module.exports = { validate };
