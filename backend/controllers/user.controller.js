const db = require("../config/db.js");
const CustomAPIError = require("../errors/custom.error.js");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuid } = require("uuid");
const s3Client = require("../config/s3Client.js");
const {
    PutObjectCommand,
    paginateListObjectsV2,
    DeleteObjectCommand,
    DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");

const updateImage = async (req, res) => {
    const user = req.user;

    if (!req.file) {
        throw new CustomAPIError("No file uploaded", 400);
    }

    const avatar = req.file;
    const avatarName = `avatars/${user.id}`;

    const uploadParams = {
        Bucket: process.env.MINIO_IMAGES_BUCKET,
        Key: avatarName,
        Body: avatar.buffer,
        ContentType: avatar.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    await db.execute("UPDATE users SET profile_image = ? WHERE id = ?", [avatarName, user.id]);

    const avatarUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_IMAGES_BUCKET}/${avatarName}`;

    res.status(200).json({
        profileImage: avatarUrl,
        message: "Your profile image has been successfully updated",
    });
};

const removeImage = async (req, res) => {
    const user = req.user;
    const avatarName = user.profile_image;

    if (avatarName) {
        const deleteParams = {
            Bucket: process.env.MINIO_IMAGES_BUCKET,
            Key: avatarName,
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
    }

    await db.execute("UPDATE users SET profile_image = ? WHERE id = ?", [null, user.id]);

    res.status(200).json({
        profileImage: null,
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

    const [[userRow]] = await db.execute("SELECT password FROM users WHERE id = ? LIMIT 1", [user.id]);
    if (!userRow) {
        throw new CustomAPIError("User not found", 404);
    }

    const isPasswordCorrect = await bcrypt.compare(oldPassword, userRow.password);
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

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // delete files
        const paginator = paginateListObjectsV2(
            {
                client: s3Client,
            },
            {
                Bucket: process.env.MINIO_FILES_BUCKET,
                Prefix: `uploads/${user.id}/`,
            },
        );

        for await (const page of paginator) {
            const objects = page.Contents;
            if (!objects || objects.length === 0) continue;

            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: process.env.MINIO_FILES_BUCKET,
                    Delete: { 
                        Objects: objects.map((o) => ({ Key: o.Key })),
                    },
                }),
            );
        }

        // delete avatar
        if (user.profile_image) {
            const deleteParams = {
                Bucket: process.env.MINIO_IMAGES_BUCKET,
                Key: user.profile_image,
            };

            await s3Client.send(new DeleteObjectCommand(deleteParams));
        }

        await conn.execute("DELETE FROM users WHERE id = ?", [user.id]);
        await conn.commit();

        res.clearCookie("token");
        res.status(200).json({ message: "Your account has been deleted" });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

module.exports = { updateImage, removeImage, updateName, changePassword, deleteUser };
