const express = require("express");
const passport = require("passport");
const session = require("express-session");
const path = require("path");

const rateLimit = require("express-rate-limit");
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many requests, please try again later.",
});

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

const indexRoutes = require("./routes/indexRoutes");
app.use("/", indexRoutes);


app.listen(5001, () => {
    console.log(`Server is running at http://localhost:5001`);
  });