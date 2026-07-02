const errorHandlerMiddleware = (err, req, res, next) => {
    let customError = {
        message: err.message || "INTERNAL SERVER ERROR",
        status: err.statusCode || 500,
    };

    if (err.code === "LIMIT_FILE_SIZE") {
        customError.message = "Please upload an image smaller than 1 MB";
        customError.status = 400;
    }

    return res.status(customError.status).json({ status: false, error: customError.message });
};

module.exports = errorHandlerMiddleware;
