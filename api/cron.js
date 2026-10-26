// api/cron.js — SELF-DIAGNOSING v2 (video fix included)
// Vercel logs kholne ki zaroorat NAHI — error khud JSON me batayega.
module.exports = async (req, res) => {
  let runScheduled;
  try {
    runScheduled = require("../lib/scheduler").runScheduled;
  } catch (e) {
    return res.status(500).json({ done: false, stage: "import", error: "require fail: " + String(e.message).slice(0, 500), version: "v2-video-fix" });
  }
  const miss = [];
  if (!process.env.UPSTASH_REDIS_REST_URL) miss.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) miss.push("UPSTASH_REDIS_REST_TOKEN");
  if (miss.length) return res.status(500).json({ done: false, stage: "env", error: "Missing: " + miss.join(","), version: "v2-video-fix" });
  try {
    const r = await runScheduled();
    return res.status(200).json({ ...r, version: "v2-video-fix" });
  } catch (e) {
    return res.status(500).json({ done: false, stage: "run", error: String(e.message).slice(0, 600), version: "v2-video-fix" });
  }
};
