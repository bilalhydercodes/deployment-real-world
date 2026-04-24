function success(res, { message = 'OK', data = null, code = 'SUCCESS', status = 200 } = {}) {
    return res.status(status).json({ success: true, code, message, data });
}

function failure(res, { message = 'Request failed', code = 'ERROR', status = 400, details = undefined } = {}) {
    return res.status(status).json({ success: false, code, message, ...(details !== undefined && { details }) });
}

module.exports = { success, failure };
