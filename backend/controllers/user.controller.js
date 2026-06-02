const db = require("../config/db.js");
const CustomAPIError = require("../errors/custom.error.js");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuid } = require("uuid");

const updateImage = async (req, res) => {
    const user = req.user;

    if (!req.files) {
        throw new CustomAPIError("No file uploaded", 400);
    }

    const profileImage = req.files.profileImage;
    if (!profileImage.mimetype.startsWith("image")) {
        throw new CustomAPIError("Please upload a valid image", 400);
    }

    const maxSize = 1024 * 1024; // 1 mb
    if (profileImage.size > maxSize) {
        throw new CustomAPIError("Please upload an image smaller than 1 MB", 400);
    }

    const uploadPath = path.join(__dirname, `../public/images/${user.id}/`);
    try {
        await fs.mkdir(uploadPath, { recursive: true });
    } catch (err) {
        throw new CustomAPIError("Something went wrong", 500);
    }

    const profileImageName = uuid() + "-" + profileImage.name;
    const imagePath = path.join(uploadPath, profileImageName);

    try {
        await profileImage.mv(imagePath);
    } catch (err) {
        throw new CustomAPIError("Something went wrong", 500);
    }

    const profileImageUrl = `${process.env.BASE_URL}/images/${user.id}/${profileImageName}`;

    try {
        const [rows] = await db.execute("SELECT profile_image FROM users WHERE id = ?", [user.id]);
        const oldImageUrl = rows[0]?.profile_image;

        await db.execute("UPDATE users SET profile_image = ? WHERE id = ?", [profileImageUrl, user.id]);

        if (oldImageUrl) {
            const oldFileName = path.basename(oldImageUrl);
            const oldImagePath = path.join(uploadPath, oldFileName);
            try {
                await fs.rm(oldImagePath, { force: true });
            } catch (_) {
            }
        }
    } catch (err) {
        try {
            await fs.rm(imagePath, { force: true });
        } catch (_) {}
        throw err;
    }

    res.status(200).json({
        profileImage: profileImageUrl,
        message: "Your profile image has been successfully updated",
    });
};

const removeImage = async (req, res) => {
    const user = req.user;

    const imagePath = path.join(__dirname, `../public/images/${user.id}/`);

    try {
        await fs.rm(imagePath, { recursive: true, force: true });
    } catch (err) {
        throw new CustomAPIError("Something went wrong", 500);
    }

    const profileImageUrl = `${process.env.BASE_URL}/images/default-profile-image.jpg`;

    await db.execute("UPDATE users SET profile_image = ? WHERE id = ?", [profileImageUrl, user.id]);

    res.status(200).json({
        profileImage: profileImageUrl,
        message: "Your profile image has been removed",
    });
};

const updateName = async (req, res) => {
    const { firstName, lastName } = req.body;
    const user = req.user;

    if (!firstName || !lastName) {
        throw new CustomAPIError("Please provide all required fields", 400);
    }

    await db.execute("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?", [firstName, lastName, user.id]);

    res.status(200).json({ firstName, lastName, message: "Your name has been successfully updated" });
};

const changePassword = async (req, res) => {
    const { oldPassword, password, password_confirmation } = req.body;
    const user = req.user;

    if (!oldPassword || !password || !password_confirmation) {
        throw new CustomAPIError("Please provide all required fields", 400);
    }

    const [rows] = await db.execute("SELECT password FROM users WHERE id = ? LIMIT 1", [user.id]);

    const isPasswordCorrect = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isPasswordCorrect) {
        throw new CustomAPIError("Please enter your current password correctly", 400);
    }

    if (password !== password_confirmation) {
        throw new CustomAPIError("Passwords are not same", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);

    res.status(200).json({ message: "Your password has been successfully updated" });
};

const deleteUser = async (req, res) => {
    const user = req.user;

    const userFilesPath = path.join(__dirname, `../private/${user.id}`);
    try {
        await fs.access(userFilesPath);
        try {
            await fs.rm(userFilesPath, { recursive: true, force: true });
        } catch (err) {
            throw new CustomAPIError("Something went wrong", 500);
        }
    } catch (error) {}

    await db.execute("DELETE FROM users WHERE id = ?", [user.id]);

    res.clearCookie("token");
    res.status(200).json({ message: "Your account has been deleted" });
};

module.exports = { updateImage, removeImage, updateName, changePassword, deleteUser };