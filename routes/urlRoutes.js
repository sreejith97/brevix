const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");

const prisma = new PrismaClient();
const redis = new Redis();

router.post("/shorten", async (req, res) => {
  if (!req.user) return res.status(401).send("Unauthorized");

  const { longUrl, customAlias, topic } = req.body;

  let alias;
  let existingUrl;

  try {
    let topicData;
    if (topic) {
      topicData = await prisma.topic.findFirst({
        where: { name: topic, createdById: req.user.id },
      });

      if (!topicData) {
        topicData = await prisma.topic.create({
          data: { name: topic, createdById: req.user.id },
        });
      }
    }

    do {
      alias = customAlias || Math.random().toString(36).substring(2, 8);
      existingUrl = await prisma.shortenedUrl.findFirst({ where: { customAlias: alias } });
    } while (existingUrl);

    const shortUrl = `${process.env.HOST_SERVER}/${alias}`;

    const newUrl = await prisma.shortenedUrl.create({
      data: {
        longUrl,
        shortUrl,
        customAlias: alias,
        topicId: topicData ? topicData.id : null,
        userId: req.user.id,
      },
    });

    await redis.setex(`shortUrl:${alias}`, 86400, newUrl.longUrl);

    res.json({ shortUrl: newUrl.shortUrl, createdAt: newUrl.createdAt });
  } catch (error) {
    console.error("Error shortening URL:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
