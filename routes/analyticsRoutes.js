const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

router.get("/:alias", async (req, res) => {
    const { alias } = req?.params;
    if (!req.user || !req.user.id) return res.redirect("/");
    console.log(alias, req.user.id);
    
    const urlStatistics = await prisma.shortenedUrl.findFirst({
        where: {
          customAlias: alias,
          userId: req?.user?.id,
        },
        include: {
          analytics: true,
         deviceanalytics:true,
          osanalytics: true,
          clickanalyticsbydate: true,
          topic:true
        },
      });

    console.log(urlStatistics)

    res.render("analytics", urlStatistics);
  });


  router.get("/topic/:topicId", async (req, res) => {
    try {
      const { topicId } = req.params;
      console.log(`Fetching analytics for topic: ${topicId}`);
  
      const topicWithUrls = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          shortenedUrls: {
            include: {
              analytics: true,
              osanalytics: true,
              deviceanalytics: true,
              clickanalyticsbydate: true,
            },
          },
        },
      });
  
      if (!topicWithUrls) {
        return res.status(404).json({ message: "Topic not found" });
      }
  
      let overallTotalClicks = 0;
      let overallTotalUniqueUsers = 0;
      let overallTotalUniqueClicks = 0;
  
      const analyticsData = topicWithUrls.shortenedUrls.map((url) => {
        const totalUniqueClicks = url.analytics.length;
        const totalClickCount = url.totalClicks;
        const totalUniqueUsers = url.uniqueUsers;
  
        overallTotalClicks += totalClickCount;
        overallTotalUniqueUsers += totalUniqueUsers;
        overallTotalUniqueClicks += totalUniqueClicks;
  
        return {
          shortUrl: url.shortUrl,
          longUrl: url.longUrl,
          totalClicks: totalClickCount,
          uniqueUsers: totalUniqueUsers,
          osAnalytics: url.osanalytics.map((os) => ({
            osName: os.osName,
            uniqueClicks: os.uniqueClicks,
            uniqueUsers: os.uniqueUsers,
          })),
          deviceAnalytics: url.deviceanalytics.map((device) => ({
            deviceName: device.deviceName,
            uniqueClicks: device.uniqueClicks,
            uniqueUsers: device.uniqueUsers,
          })),
          clickAnalyticsByDate: url.clickanalyticsbydate.map((clicks) => ({
            date: clicks.date.toISOString().split("T")[0], // Format: YYYY-MM-DD
            clickCount: clicks.clickCount,
            uniqueUsers: clicks.uniqueUsers,
          })),
          aggregatedData: {
            totalUniqueClicks: totalUniqueClicks,
            totalUniqueUsers: totalUniqueUsers,
            totalClickCount: totalClickCount,
          },
        };
      });
  
    
      const overallAggregatedData = {
        totalUniqueClicks: overallTotalUniqueClicks,
        totalUniqueUsers: overallTotalUniqueUsers,
        totalClickCount: overallTotalClicks,
      };

    const finalData = {
            topic: topicWithUrls.name,
            analytics: analyticsData,
            overallAggregatedData,
          }

          res.render("topic", finalData)
    } catch (error) {
      console.error("Error fetching topic data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
  


module.exports = router;
