// api/cron.js - Cron BAND - Instant Post ON - Queue / Redis nahi chahiye
module.exports = async (req, res) => {
  return res.status(200).json({ done: true, message: "Cron band hai - Instant Post ON hai", version: "cron-off-v1" });
};
