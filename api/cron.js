// api/cron.js — Redis ke bina chalega, queue check karega
module.exports = async (req, res) => {
  let runScheduled;
  try {
    runScheduled = require("../lib/scheduler").runScheduled;
  } catch (e) {
    return res.status(500).json({ done: false, stage: "import", error: "require fail: " + String(e.message).slice(0, 500), version: "no-redis-fix" });
  }
  try {
    const r = await runScheduled();
    return res.status(200).json({ ...r, version: "no-redis-fix" });
  } catch (e) {
    return res.status(500).json({ done: false, stage: "run", error: String(e.message).slice(0, 600), version: "no-redis-fix" });
  }
};
