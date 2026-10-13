// Queue — in-memory for now. For production persistence across
// serverless invocations, plug Upstash Redis here (free tier).
let queue = [];

function addJob(niche, productUrl) {
  const GAP_MS = 90 * 60000; // 90 min gap
  const lastAt = queue.length ? queue[queue.length - 1].at : Date.now();
  queue.push({ niche, productUrl, at: lastAt + GAP_MS, done: false });
  return queue.length;
}

function dueJobs() {
  const now = Date.now();
  return queue.filter(j => !j.done && j.at <= now);
}

function markDone(job) { job.done = true; }

module.exports = { addJob, dueJobs, markDone };
