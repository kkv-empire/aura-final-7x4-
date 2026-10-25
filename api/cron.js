// api/cron.js — SELF-DIAGNOSING version
// Import time pe crash ho to bhi JSON me asli wajah batayega (FUNCTION_INVOCATION_FAILED nahi)
module.exports = async (req, res) => {
  let runScheduled;
  try {
    runScheduled = require("../lib/scheduler").runScheduled;
  } catch (e) {
    return res.status(500).json({
      done: false,
      stage: "import",
      error: "require fail: " + String(e.message || e).slice(0, 500),
      hint: "Koi lib file missing ya usme top-level crash hai. GitHub pe saari lib/* files hain?",
    });
  }
  const missing = [];
  if (!process.env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
  if (!process.env.TG_BOT_TOKEN) missing.push("TG_BOT_TOKEN");
  if (missing.length) {
    return res.status(500).json({ done: false, stage: "env", error: "Missing env: " + missing.join(", ") });
  }
  try {
    const result = await runScheduled();
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({
      done: false,
      stage: "run",
      error: String(e.message || e).slice(0, 500),
      stack: String(e.stack || "").split("\n").slice(0, 5).join(" | ").slice(0, 500),
    });
  }
};
