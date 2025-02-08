const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

router.get("/", (req, res) => {
  res.render("index");
});

router.get("/dashboard", async (req, res) => {
  if (!req.user || !req.user.id) return res.redirect("/");

  const userWithUrls = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { shortenedUrls: { include: { topic: true } }, topics: true },
  });

  res.render("dashboard", { user: userWithUrls });
});

router.get("/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect("/");
  });
});

module.exports = router;
