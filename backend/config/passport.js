const db = require("../config/db.js");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const crypto = require("crypto");
const bcrypt = require("bcrypt");

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            // extract information
            const firstName = profile.displayName.split(" ")[0] || "User";
            const lastName = profile.displayName.split(" ")[profile.displayName.split(" ").length - 1] || "";
            const email = profile.emails[0].value;
            const password = crypto.randomBytes(10).toString("hex");

            if (!firstName || !lastName || !email) {
                throw new CustomAPIError("Something went wrong", 400);
            }

            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);

            try {
                const [existing] = await db.execute(`SELECT * FROM users WHERE email = ?`, [email]);                
                let user = existing[0];

                if (!user) {
                    const [result] = await db.execute(
                        `INSERT INTO users (first_name, last_name, email, password) 
                        VALUES (?, ?, ?, ?)`,
                        [firstName, lastName, email, hashedPassword]
                    );
                    const [userRows] = await db.execute(`SELECT * FROM users WHERE id = ?`, [result.insertId]);
                    user = userRows[0];
                }

                return done(null, user);
            } catch (error) {
                done(null, error);
            }
        },
    ),
);