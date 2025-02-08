
const express = require('express');
const cron = require('node-cron');
const fetch = require('node-fetch'); // Import node-fetch for making API calls
const router = express.Router();

// Schedule a task to run every 3 minutes
cron.schedule('*/3 * * * *', async () => {
  try {
   
    const response = await fetch(process.env.CRON_URL_TEST);
    const data = await response.json();


    console.log(`API Call Successful: ${new Date().toLocaleString()}`);
    console.log(`Current Date and Time (UTC): ${data.utc_datetime}`);
  } catch (error) {
    console.error('Error calling the API:', error);
  }
});

router.get('/cron-status', (req, res) => {
  res.send('Cron job is running...');
});

module.exports = router;
