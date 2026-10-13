// For Node.js / server environments — on Vercel, cron.js handles this instead
const cron = require('node-cron');
const { dueJobs, markDone } = require('./queue');
const { postToAllPlatforms } = require('./distributor');

function startScheduler() {
  cron.schedule('*/30 * * * *', async () => {
    const jobs = dueJobs();
    for (const job of jobs) {
      try {
        await postToAllPlatforms(job.niche, job.productUrl);
        markDone(job);
      } catch (e) { console.error('scheduled post failed', e.message); }
    }
  });
  console.log('Scheduler started — every 30 min.');
}

module.exports = { startScheduler };
