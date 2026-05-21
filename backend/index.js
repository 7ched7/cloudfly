require("dotenv").config();
const express = require("express");
const app = express();
const path = require('path');
const connectToDB = require("./config/db.js");
const cookieParser = require('cookie-parser')
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const session = require("express-session");
const passport = require("passport");
require("./config/passport.js");
const errorHandlerMiddleware = require("./middlewares/error.handler.js");
const authRoute = require("./routes/auth.route.js");
const userRoute = require("./routes/user.route.js");
const driveRoute = require("./routes/drive.route.js");

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
}
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));
app.use(compression());

app.use(cookieParser())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// routes
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/drive", driveRoute);

// error handling
app.use(errorHandlerMiddleware);

// connect db & start server
const start = async () => {
    try {
        await connectToDB(process.env.MONGO_URI);
        app.listen(PORT, console.log(`Server is listening on port ${PORT}`));
    } catch (e) {
        console.log(e);
    }
};
start();
