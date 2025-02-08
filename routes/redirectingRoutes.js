const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");
const useragent = require('useragent');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URI)


async function trackAnalyticsAndClicks(req, alias) {
  try {

    const urlData = await prisma.shortenedUrl.findFirst({
      where: { customAlias: alias },
      include: { user: true },
    });

    if (!urlData) return console.log(`Short URL not found for alias: ${alias}`);

    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split("T")[0]; 
    const agent = useragent.parse(req.headers['user-agent']);
    const osType = agent.os.toString();
    const deviceType = agent.device.toString();

    let ip = req.headers['x-forwarded-for'] || requestIp.getClientIp(req);
    if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8'; 
    const geoLoc = geoip.lookup(ip);
    const location = geoLoc ? `${geoLoc.city}, ${geoLoc.country}` : 'Unknown';

    const uniqueClickCount = await prisma.analytics.count({
      where: { shortUrlId: urlData.id, ipAddress: ip },
    });

    const isUniqueClick = uniqueClickCount === 0; 

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

    // console.log(`Click recorded : ${alias}, Unique: ${isUniqueClick}`);

    await prisma.shortenedUrl.update({
      where: { id: urlData.id },
      data: {
        totalClicks: { increment: 1 },
        uniqueUsers: isUniqueClick ? { increment: 1 } : undefined, 
      },
    });

    await Promise.all([
      prisma.oSAnalytics.upsert({
        where: { shortUrlId_osName: { shortUrlId: urlData.id, osName: osType } },
        update: {
          uniqueClicks: { increment: 1 },
          uniqueUsers: isUniqueClick ? { increment: 1 } : undefined,
        },
        create: {
          shortUrlId: urlData.id,
          osName: osType,
          uniqueClicks: 1,
          uniqueUsers: isUniqueClick ? 1 : 0,
        },
      }),

      prisma.deviceAnalytics.upsert({
        where: { shortUrlId_deviceName: { shortUrlId: urlData.id, deviceName: deviceType } },
        update: {
          uniqueClicks: { increment: 1 },
          uniqueUsers: isUniqueClick ? { increment: 1 } : undefined,
        },
        create: {
          shortUrlId: urlData.id,
          deviceName: deviceType,
          uniqueClicks: 1,
          uniqueUsers: isUniqueClick ? 1 : 0,
        },
      }),

      prisma.clickAnalyticsByDate.upsert({
        where: { shortUrlId_date: { shortUrlId: urlData.id, date: new Date(dateStr) } },
        update: {
          clickCount: { increment: 1 },
          uniqueUsers: isUniqueClick ? { increment: 1 } : undefined,
        },
        create: {
          shortUrlId: urlData.id,
          date: new Date(dateStr),
          clickCount: 1,
          uniqueUsers: isUniqueClick ? 1 : 0,
        },
      })
    ]);

    if (urlData.user.id) {
      const userId = urlData.user.id;

      const [totalClicks, totalUniqueUsers, totalShortUrls] = await Promise.all([
        prisma.shortenedUrl.aggregate({
          where: { userId },
          _sum: { totalClicks: true },
        }),
        prisma.shortenedUrl.aggregate({
          where: { userId },
          _sum: { uniqueUsers: true },
        }),
        prisma.shortenedUrl.count({ where: { userId } }),
      ]);

      await prisma.user.update({
        where: { id: userId },
        data: {
          totalShortUrls: totalShortUrls,
          totalClicks: totalClicks._sum.totalClicks || 0,
          totalUniqueUsers: totalUniqueUsers._sum.uniqueUsers || 0,
        },
      });

      // console.log(`Updated user (${userId}) Data.`);
    }
  } catch (error) {
    console.error("Error in tracking analytics:", error);
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
    console.error("Error in redirect route:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
