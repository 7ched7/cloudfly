const db = require("../config/db.js");
const CustomAPIError = require("../errors/custom.error.js");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { attachCookiesToResponse } = require("../utils/jwt.js");
const sendResetPasswordEmail = require("../utils/sendResetPasswordEmail.js");

const registerUser = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        throw new CustomAPIError("Please provide all required fields", 400);
    }

    const [rows] = await db.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (rows.length > 0) {
        throw new CustomAPIError("This email address is already used", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.execute(
        `INSERT INTO users (first_name, last_name, email, password) 
        VALUES (?, ?, ?, ?)`,
        [firstName, lastName, email, hashedPassword],
    );

    return res.status(201).json({ message: "Registration successful!" });
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new CustomAPIError("Please provide all required fields", 400);
    }

    const [rows] = await db.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    if (rows.length === 0) {
        throw new CustomAPIError("Invalid credentials", 404);
    }

    const user = rows[0];

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        throw new CustomAPIError("Invalid credentials", 400);
    }

    attachCookiesToResponse({ res, payload: { userId: user.id } });

    return res.status(200).json({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        profileImage: user.profile_image,
        currentStorage: user.current_storage,
        maxStorage: user.max_storage,
    });
};

const googleSign = async (req, res) => {
    attachCookiesToResponse({ res, payload: { userId: req.user.id } });
    return res.redirect(process.env.FRONTEND_URL + "/drive");
};

const logout = async (req, res) => {
    res.cookie("token", "", {
        httpOnly: true,
        expires: new Date(Date.now() + 1000),
    });
    res.status(200).json({ message: "You logged out" });
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new CustomAPIError("Please provide email address", 400);
    }

    const [rows] = await db.execute("SELECT id, first_name, email FROM users WHERE email = ? LIMIT 1", [email]);

    if (rows.length > 0) {
        const user = rows[0];

        const token = crypto.randomBytes(70).toString("hex");
        const tenMinutes = 1000 * 60 * 10;
        const expirationDate = new Date(Date.now() + tenMinutes);

        const conn = await db.getConnection();
        await conn.beginTransaction();

        try {
            await conn.execute(
                `INSERT INTO reset_password_tokens (token, expiration_date, user) 
                VALUES (?, ?, ?)`,
                [token, expirationDate, user.id],
            );

            await sendResetPasswordEmail({
                name: user.first_name,
                email: user.email,
                token: token,
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    res.status(200).json({ message: "Please check your email for reset password link" });
};

const resetPassword = async (req, res) => {
    const { token, password, password_confirmation } = req.body;

    if (!token || !password || !password_confirmation) {
        throw new CustomAPIError("Please provide all required fields", 400);
    }

    if (password !== password_confirmation) {
        throw new CustomAPIError("Passwords are not same", 400);
    }

    const [resetPasswordTokenRows] = await db.execute("SELECT * FROM reset_password_tokens WHERE token = ? LIMIT 1", [
        token,
    ]);
    const resetPasswordToken = resetPasswordTokenRows[0];

    if (!resetPasswordToken) {
        throw new CustomAPIError("Token is invalid", 400);
    }

    const currentDate = new Date();
    const expirationDate = new Date(resetPasswordToken.expiration_date);
    if (expirationDate.getTime() < currentDate.getTime()) {
        await db.execute("DELETE FROM reset_password_tokens WHERE id = ?", [resetPasswordToken.id]);
        throw new CustomAPIError("Token has expired", 400);
    }

    const [userRows] = await db.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [resetPasswordToken.user]);
    const user = userRows[0];

    if (!user) {
        throw new CustomAPIError("User not found", 404);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        await conn.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);
        await conn.execute("DELETE FROM reset_password_tokens WHERE id = ?", [resetPasswordToken.id]);

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    res.status(200).json({ message: "Your password has been successfully updated" });
};

const verifyToken = async (req, res) => {
    const user = req.user;
    return res.status(200).json({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        profileImage: user.profile_image,
        currentStorage: user.current_storage,
        maxStorage: user.max_storage,
    });
};

module.exports = { registerUser, loginUser, googleSign, logout, forgotPassword, resetPassword, verifyToken };
