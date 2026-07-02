const express = require("express");
const router = express.Router();
const CustomAPIError = require("../errors/custom.error.js");
const { rateLimit } = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const { authenticateUser } = require("../middlewares/authentication.js");
const {
    updateImage,
    removeImage,
    updateName,
    changePassword,
    deleteUser,
} = require("../controllers/user.controller.js");

const limiter = rateLimit({
    windowMs: 1000 * 60 * 5,
    limit: 10,
    handler: (req, res) => {
        res.status(429).json({
            status: false,
            error: "Too many requests, please try again later",
        });
    },
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new CustomAPIError("Please upload a valid image", 400));
        }
        return cb(null, true);
    },
});

router.put("/update-image", limiter, authenticateUser, upload.single("profileImage"), updateImage);
router.delete("/remove-image", limiter, authenticateUser, removeImage);
router.put("/update-name", limiter, authenticateUser, updateName);
router.put("/change-password", limiter, authenticateUser, changePassword);
router.delete("/delete", limiter, authenticateUser, deleteUser);

module.exports = router;
