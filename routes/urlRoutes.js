const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");

const prisma = new PrismaClient();
const redis = new Redis();

router.post("/shorten", async (req, res) => {
  if (!req.user) return res.status(401).send("Unauthorized");

  const { longUrl, customAlias, topic } = req.body;
  console.log(longUrl, customAlias, topic);
  

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

    let alias = customAlias || Math.random().toString(36).substring(2, 8);

    // ✅ Check if alias already exists, if so, generate a new one (only if no customAlias was provided)
    let existingUrl = await prisma.shortenedUrl.findFirst({ where: { customAlias: alias } });

    console.log("existingUrl", existingUrl);
    
    if (existingUrl) {
      if (customAlias) {
        return res.status(400).json({ error: "Custom alias already in use. Please choose another." });
      }
      // Generate a new alias if the existing alias is taken and no custom alias was provided
      do {
        alias = Math.random().toString(36).substring(2, 8);
        existingUrl = await prisma.shortenedUrl.findFirst({ where: { customAlias: alias } });
      } while (existingUrl);
    }

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

    res.json({
      shortUrl: newUrl.shortUrl,
      createdAt: newUrl.createdAt,
      customAlias: newUrl.customAlias,
      topic: topicData ? topicData.name : null,
    });
  } catch (error) {
    console.error("❌ Error shortening URL:", error);
    res.status(500).send("Internal Server Error");
  }
});


module.exports = router;
