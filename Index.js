// AURA 7x4 Auto-Posting Bot — entry point
const { runQueue } = require('./lib/scheduler');
const bot = require('./lib/telegramBot');

console.log('AURA 7x4 bot started. 7 niches x 4 platforms.');
bot.launch();
runQueue();

// Vercel pe band na ho isliye
process.on('SIGINT', () => { bot.stop(); process.exit(0); });
process.on('SIGTERM', () => { bot.stop(); process.exit(0); });
