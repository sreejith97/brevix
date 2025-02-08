require("dotenv").config();
const express = require("express");
const passport = require("passport");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const Redis = require("ioredis");
const path = require("path");

require("./config/passport"); 

const app = express();
const redis = new Redis(process.env.REDIS_URI)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many requests, please try again later.",
});
app.use("/api/shorten", limiter);


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());


const authRoutes = require("./routes/authRoutes");
const urlRoutes = require("./routes/urlRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const indexRoutes = require("./routes/indexRoutes");
const redirectionRoutes = require("./routes/redirectingRoutes")


app.use("/", indexRoutes);
app.use("/auth", authRoutes);
app.use("/api", urlRoutes);
app.use("/", redirectionRoutes);
app.use("/analytics", analyticsRoutes)


app.listen(5000, () => {
  console.log(`Server is running at http://localhost:5000`);
});