const sendResponse = (res, { status = 200, message = '', data = null }) => {
    return res.status(status).json({
        status,
        message,
        data,
    });
};

module.exports = { sendResponse };