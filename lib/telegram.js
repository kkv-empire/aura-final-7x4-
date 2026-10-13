const axios = require('axios');
const niches = require('../config/niches.json');

async function postTelegram(niche, video, caption) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = niches[niche]?.telegram_id;
  if (!token ||!chatId) { console.log(`[TG] ${niche}: no token/chat`); return; }
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`,
    { chat_id: chatId, text: caption });
  console.log(`[TG] ${niche}: posted`);
}

module.exports = { postTelegram };
