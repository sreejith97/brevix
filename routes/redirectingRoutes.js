const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");
const useragent = require('useragent');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');

const prisma = new PrismaClient();
const redis = new Redis();

async function trackAnalyticsAndClicks(req, alias) {
  try {
    const urlData = await prisma.shortenedUrl.findFirst({
      where: { customAlias: alias },
      include: { analytics: true }, 
    });

    if (!urlData) return console.log(`Short URL not found for alias: ${alias}`);

    const timestamp = new Date();
    const agent = useragent.parse(req.headers['user-agent']);
    const osType = agent.os.toString();
    const deviceType = agent.device.toString();

    let ip = req.headers['x-forwarded-for'] || requestIp.getClientIp(req);
    if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8'; 
    const geoLoc = geoip.lookup(ip);
    const location = geoLoc ? `${geoLoc.city}, ${geoLoc.country}` : 'Unknown';

  
    const existingClick = await prisma.analytics.findFirst({
      where: {
        shortUrlId: urlData.id,
        OR: [{ ipAddress: ip }, { deviceType: deviceType }],
      },
    });

    const isUniqueClick = !existingClick; 

    await prisma.analytics.create({
      data: {
        shortUrl: urlData.shortUrl,
        userAgent: req.headers['user-agent'],
        ipAddress: ip,
        location: location,
        osType: osType,
        deviceType: deviceType,
        timestamp: timestamp,
        shortUrlId: urlData.id,
      },
    });

    if (isUniqueClick) {
      await prisma.shortenedUrl.update({
        where: { id: urlData.id },
        data: {
          totalClicks: { increment: 1 },
          uniqueUsers: { increment: 1 },
        },
      });

      console.log(` Unique click : ${alias}`);
    } else {
      console.log(` Duplicate click detected.`);
    }
  } catch (error) {
    console.error("Error and updating unique clicks:", error);
  }
}


router.get('/:alias', async (req, res) => {
  try {
    const { alias } = req.params;

    console.log(`Received request for alias: ${alias}`);

  
    let cachedUrl = await redis.get(`shortUrl:${alias}`);
    if (cachedUrl) {
      console.log("Cache hit! Redirecting to:", cachedUrl);

      await trackAnalyticsAndClicks(req, alias);

      return res.redirect(cachedUrl);
    }
    const urlData = await prisma.shortenedUrl.findFirst({
      where: { customAlias: alias },
    });

    if (!urlData) {
      console.log(`Short URL not found for alias: ${alias}`);
      return res.status(404).send("Short URL not found.");
    }

    console.log(`URL found: ${urlData.longUrl}`);

    await redis.setex(`shortUrl:${alias}`, 86400, urlData.longUrl);

    await trackAnalyticsAndClicks(req, alias);

    res.redirect(urlData.longUrl);
  } catch (error) {
    console.error("Error in redirect route: ", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
