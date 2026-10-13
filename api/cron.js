// Vercel Cron — hits every 30 min, posts due jobs with gaps
const { dueJobs, markDone } = require('../lib/queue');
const { postToAllPlatforms } = require('../lib/distributor');

module.exports = async (req, res) => {
  // Optional safety: check CRON_SECRET
  // if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).send('no');

  const jobs = dueJobs();
  // Post max 1 job per cron hit to respect gaps
  if (jobs.length) {
    const job = jobs[0];
    try {
      await postToAllPlatforms(job.niche, job.productUrl);
      markDone(job);
    } catch (e) {
      console.error('cron post failed', e.message);
    }
  }
  return res.status(200).json({ processed: jobs.length ? 1 : 0 });
};
