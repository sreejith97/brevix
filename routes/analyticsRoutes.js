const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");
const useragent = require('useragent');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');

const prisma = new PrismaClient();
const redis = new Redis();



router.get("/", (req, res) => {
    res.render("analytics");
  });


module.exports = router;
