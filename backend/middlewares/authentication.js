const db = require("../config/db.js");
const CustomAPIError = require("../errors/custom.error.js");
const { isTokenValid } = require("../utils/jwt.js");

const authenticateUser = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        throw new CustomAPIError("Authentication Invalid", 401);
    }

    try {
        const { userId } = isTokenValid({ token });

        const [rows] = await db.execute(
            `
            SELECT id, first_name, last_name, email, profile_image, current_storage, max_storage FROM users 
            WHERE id = ? 
            LIMIT 1 `,
            [userId],
        );

        if (rows.length === 0) {
            throw new CustomAPIError("Authentication Invalid", 401);
        }

        req.user = rows[0];
        next();
    } catch (error) {
        throw new CustomAPIError("Authentication Invalid", 401);
    }
};

module.exports = { authenticateUser };
