const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const router = express.Router();

cron.schedule('*/3 * * * *', async () => {
  try {
      console.log(`Current Date and Time (UTC): ${new Date().toLocaleString()}`);
      if (!process.env.CRON_URL_TEST) {
          throw new Error('CRON_URL_TEST environment variable is not set');
       
    }

    const response = await axios.get(process.env.CRON_URL_TEST);


    console.log(`Current Date and Time (UTC): ${response.data.utc_datetime}`);
  } catch (error) {
    console.error('Error calling the API:', error.message);
  }
});

router.get('/cron-status', (req, res) => {
  res.send('Cron job is running...');
});

module.exports = router;
