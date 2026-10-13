// AURA 7x4 Auto-Posting Bot — entry point
// Free hosting: Vercel / Render. Paid upgrade later.
const { runQueue } = require('./lib/scheduler');
const bot = require('./lib/telegramBot');

console.log('AURA 7x4 bot started. 7 niches x 4 platforms.');
bot.launch();
runQueue();
