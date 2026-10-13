// Telegram webhook — set this URL in BotFather / setWebhook
// https://tumhara-app.vercel.app/api/telegram
const { addJob } = require('../lib/queue');
const niches = require('../config/niches.json');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('AURA 7x4 webhook alive');

  const msg = req.body?.message;
  const text = msg?.text || '';
  const chatId = msg?.chat?.id;

  const m = text.match(/^\/post\s+(\w+)\s+(https?\S+)/);
  if (!m) {
    await reply(chatId, 'Use: /post <niche> <amazon-link>\nNiches: ' + Object.keys(niches).join(', '));
    return res.status(200).send('ok');
  }

  const [, niche, url] = m;
  if (!niches[niche]) {
    await reply(chatId, 'Unknown niche. Choose: ' + Object.keys(niches).join(', '));
    return res.status(200).send('ok');
  }

  const pos = addJob(niche, url);
  await reply(chatId, `✅ Queued ${niche} (#${pos} in queue). Cron will post it with gaps.`);
  return res.status(200).send('ok');
};

async function reply(chatId, text) {
  if (!chatId) return;
  const axios = require('axios');
  await axios.post(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text });
}
