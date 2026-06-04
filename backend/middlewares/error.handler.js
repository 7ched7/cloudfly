const errorHandlerMiddleware = (err, req, res, next) => {
    let customError = {
        message: err.message || "INTERNAL SERVER ERROR",
        status: err.statusCode || 500,
    };

    return res.status(customError.status).json({ status: false, error: customError.message });
};

module.exports = errorHandlerMiddleware;
