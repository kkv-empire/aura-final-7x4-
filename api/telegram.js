// api/telegram.js — SELF-DIAGNOSING + AUTO-CRON version
// Niche select karte hi bot KHUD /api/cron trigger karta hai — koi schedule nahi chahiye!
// Vercel logs kholne ki zaroorat NAHI — problem hogi to bot KHUD Telegram pe batayega.

const TOKEN = process.env.TG_BOT_TOKEN;
const NICHES = ["Aivendora", "Trendmind", "Smartshiply", "Nichepilot", "Adbrainx", "Cartflow", "Globaldrop"];
const pkey = (chat) => `aura:pending:${chat}`;

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Lazy Redis — env missing ho to seedha user ko samjhata hai
let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const e = new Error("env missing");
    e.userMessage =
      "⚠️ <b>Upstash Redis nahi mila!</b>\n\nVercel → Settings → Environment Variables me ye 2 add karo:\n" +
      "• UPSTASH_REDIS_REST_URL\n• UPSTASH_REDIS_REST_TOKEN\n\n(Upstash dashboard → REST API se copy karo)\n" +
      "Fir <b>Deployments → Redeploy</b> dabao 🔄";
    throw e;
  }
  const { Redis } = require("@upstash/redis");
  _redis = new Redis({ url, token });
  return _redis;
}

async function pushProduct(p) {
  const r = getRedis();
  const id = "p" + Date.now().toString(36);
  await r.hset(`aura:product:${id}`, { ...p, id, status: "queued", createdAt: new Date().toISOString() });
  await r.rpush("aura:queue", id);
  return id;
}

async function queueLength() {
  return await getRedis().llen("aura:queue");
}

// Cron ko turant trigger karo (fire-and-forget — response ka wait nahi)
function triggerCron(host) {
  if (!host) return;
  const url = `https://${host}/api/cron`;
  fetch(url).catch(() => {});
}

// /start pe poora health report
async function healthReport() {
  const lines = ["🏥 <b>System Health:</b>"];
  lines.push("✅ Telegram token: OK");
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await getRedis().ping();
      lines.push("✅ Redis queue: OK");
    } catch (e) {
      lines.push("❌ Redis connect fail: " + String(e.message || e).slice(0, 80));
    }
  } else {
    lines.push("❌ Redis: env variables missing");
  }
  lines.push("⚡ Auto-cron: ON (niche dabate hi video banana shuru)");
  lines.push(process.env.AMAZON_TAG ? "✅ Amazon tag: OK" : "⚠️ Amazon tag: missing (link bina commission ke banega)");
  return lines.join("\n");
}

function nicheButtons(asin) {
  const rows = [];
  for (let i = 0; i < NICHES.length; i += 2) {
    const row = [{ text: NICHES[i], callback_data: `niche:${asin}:${NICHES[i]}` }];
    if (NICHES[i + 1]) row.push({ text: NICHES[i + 1], callback_data: `niche:${asin}:${NICHES[i + 1]}` });
    rows.push(row);
  }
  return rows;
}

function extractASIN(text) {
  const m = String(text).match(/amazon\.in\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

async function handleUpdate(update) {
  let queuedProduct = false;

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const parts = String(cb.data || "").split(":");
    const asin = parts[1], niche = parts[2];
    const p = await getRedis().get(pkey(chatId));
    if (p && p.asin === asin) {
      await pushProduct({ ...p, niche });
      queuedProduct = true;
      await getRedis().del(pkey(chatId));
      const n = await queueLength();
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Video ban rahi hai 🎬" });
      await tg("editMessageText", {
        chat_id: chatId, message_id: cb.message.message_id, parse_mode: "HTML",
        text: `✅ <b>${niche}</b> me save ho gaya!\n📦 ${String(p.title).slice(0, 100)}\n\n🎬 <b>Video abhi ban rahi hai</b> — 2-3 min me 4 platforms pe post hogi 🚀\n📊 Queue me ab: ${n} product(s)`,
      });
    } else {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Session expire — link dobara bhejo" });
    }
    return queuedProduct;
  }

  const msg = update.message;
  if (!msg || !msg.text) return queuedProduct;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text === "/start") {
    const health = await healthReport();
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
      text: `🤖 <b>Aura Bot LIVE hai!</b>\n\n${health}\n\n1️⃣ Amazon.in ka product link bhejo\n2️⃣ Niche ka button dabao\n3️⃣ Video turant banke 4 platforms pe auto-post 🚀\n\n📊 /status — queue dekho`,
    });
    return queuedProduct;
  }

  if (text === "/status") {
    const n = await queueLength();
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `📊 Queue me: <b>${n}</b> product(s)` });
    return queuedProduct;
  }

  const asin = extractASIN(text);
  if (!asin) {
    await tg("sendMessage", { chat_id: chatId, text: "🔗 Amazon.in ka product link bhejo shuru karne ke liye." });
    return queuedProduct;
  }

  await tg("sendMessage", { chat_id: chatId, text: "🔍 Link mil gaya… details nikaal raha hoon…" });
  try {
    const { fetchProduct } = require("../lib/amazon");
    const p = await fetchProduct(asin);
    await getRedis().set(pkey(chatId), p, { ex: 600 });
    const feats = (p.features || []).slice(0, 2).map((f) => `✨ ${f}`).join("\n");
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
      text: `📦 <b>${p.title.slice(0, 120)}</b>\n${p.price ? `💰 ${p.price}\n` : ""}${feats ? feats + "\n" : ""}🖼️ ${p.images.length} photos mili\n\n👇 Niche chuno:`,
      reply_markup: { inline_keyboard: nicheButtons(asin) },
    });
  } catch (e) {
    if (e.userMessage) throw e;
    const err = new Error("amazon fail");
    err.userMessage = `⚠️ Amazon page nahi khul paya.\n${String(e.message || e).slice(0, 120)}\n\n2 min baad link dobara bhejo.`;
    throw err;
  }
  return queuedProduct;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("Aura bot live 🤖");
  const update = req.body || {};
  const chatId = (update.message && update.message.chat && update.message.chat.id) ||
                 (update.callback_query && update.callback_query.message && update.callback_query.message.chat.id);
  try {
    const queued = await handleUpdate(update);
    // Niche select hua → turant cron trigger karo (fire-and-forget)
    if (queued) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      triggerCron(host);
    }
  } catch (e) {
    console.error("webhook error:", e && e.message);
    if (chatId) {
      const msg = e.userMessage || ("⚠️ Error: " + String((e && e.message) || e).slice(0, 250));
      try {
        await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: msg });
      } catch (_) {}
    }
  }
  return res.status(200).send("ok");
};
