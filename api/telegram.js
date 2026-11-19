// api/telegram.js — INSTANT POST, NO QUEUE, NO CRON
// Niche dabate hi sidha Video banake Telegram + Instagram pe post

const TOKEN = process.env.TG_BOT_TOKEN;
const NICHES = ["Aivendora", "Trendmind", "Smartshiply", "Nichepilot", "Adbrainx", "Cartflow", "Globaldrop"];
const pkey = (chat) => `aura:pending:${chat}`;
const mkey = (chat) => `aura:manual:${chat}`;
const ukey = (chat) => `aura:last_update:${chat}`;

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const e = new Error("env missing");
    e.userMessage = "⚠️ Upstash Redis nahi mila! Vercel me UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN add karo, fir Redeploy dabao";
    throw e;
  }
  const { Redis } = require("@upstash/redis");
  _redis = new Redis({ url, token });
  return _redis;
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

async function finishManualProduct(chatId, m) {
  const tag = process.env.AMAZON_TAG || "";
  const asin = m.asin || ("MANUAL" + Date.now().toString(36).toUpperCase());
  const p = {
    asin,
    title: m.title || "Product",
    price: m.price || "",
    images: m.photoUrl ? [m.photoUrl] : [],
    features: [],
    amazon_link: m.url || "",
    affiliate_link: tag && m.url ? `${m.url}?tag=${tag}` : (m.url || ""),
  };
  await getRedis().set(pkey(chatId), p, { ex: 600 });
  await tg("sendMessage", {
    chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
    text: `📦 <b>${p.title.slice(0, 120)}</b>\n${p.price ? `💰 ${p.price}\n` : ""}🖼️ ${p.images.length} photo\n\n👇 Niche chuno:`,
    reply_markup: { inline_keyboard: nicheButtons(p.asin) },
  });
}

async function handleUpdate(update) {
  // Duplicate webhook rokne ke liye - 1 update 1 baar hi chalega
  const updateId = String(update.update_id || "");
  const chatIdForDedup = (update.message && update.message.chat && update.message.chat.id) || (update.callback_query && update.callback_query.message && update.callback_query.message.chat.id);
  if (chatIdForDedup && updateId) {
    const last = await getRedis().get(ukey(chatIdForDedup));
    if (last === updateId) return false;
    await getRedis().set(ukey(chatIdForDedup), updateId, { ex: 60 });
  }

  // NICHE DABAYA TO - SIDHA POST, QUEUE NAHI
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const parts = String(cb.data || "").split(":");
    const asin = parts[1], niche = parts[2];
    const p = await getRedis().get(pkey(chatId));
    if (p && p.asin === asin) {
      await getRedis().del(pkey(chatId));
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Video ban rahi hai 🎬" });
      await tg("editMessageText", {
        chat_id: chatId, message_id: cb.message.message_id, parse_mode: "HTML",
        text: `✅ <b>${niche}</b> me save ho gaya!\n📦 ${String(p.title).slice(0, 100)}\n\n🎬 <b>Video abhi ban rahi hai</b> — 5 min me post hogi 🚀`,
      });
      // SIDHA DISTRIBUTE - QUEUE / CRON NAHI
      try {
        const { distribute } = require("../lib/distributor");
        const result = await distribute({ ...p, niche });
        await tg("sendMessage", {
          chat_id: chatId, parse_mode: "HTML",
          text: `✅ <b>Post ho gaya!</b>\n📦 ${String(p.title).slice(0, 100)}\n✔️ Telegram: ${result.telegram || "OK"}\n✔️ Instagram: ${result.instagram || "OK"}`,
        });
      } catch (e) {
        await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `❌ <b>Post fail:</b>\n${String(e.message || e).slice(0, 300)}\n\nDobara Niche dabao ya naya product bhejo.` });
      }
    } else {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Session expire — dobara bhejo" });
    }
    return false;
  }

  const msg = update.message;
  if (!msg) return false;
  const chatId = msg.chat.id;

  // PHOTO AAYI TO - MANUAL MODE ON
  if (msg.photo && msg.photo.length) {
    const photo = msg.photo[msg.photo.length - 1];
    const f = await tg("getFile", { file_id: photo.file_id });
    const fp = f && f.result && f.result.file_path;
    if (!fp) {
      await tg("sendMessage", { chat_id: chatId, text: "⚠️ Photo download nahi hui, dobara bhejo." });
      return false;
    }
    const photoUrl = `https://api.telegram.org/file/bot${TOKEN}/${fp}`;
    const caption = (msg.caption || "").trim();
    const m = await getRedis().get(mkey(chatId));
    if (m && m.step === "photo") {
      m.photoUrl = photoUrl;
      m.step = "title";
      await getRedis().set(mkey(chatId), m, { ex: 600 });
      await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: "📸 <b>Photo mil gayi!</b>\n\n📝 Ab product ka <b>naam</b> likho:" });
      return false;
    }
    if (caption) {
      await getRedis().set(mkey(chatId), { step: "price", title: caption.slice(0, 200), photoUrl }, { ex: 600 });
      await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `📸 <b>Photo + Naam mil gaya!</b> - ${caption.slice(0, 100)}\n\n💰 Ab <b>price</b> likho (jaise ₹499) ya <b>skip</b> likho:` });
      return false;
    }
    await getRedis().set(mkey(chatId), { step: "title", photoUrl }, { ex: 600 });
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: "📸 <b>Photo mil gayi!</b>\n\n📝 Ab product ka <b>naam</b> likho:" });
    return false;
  }

  const text = (msg.text || "").trim();
  if (!text) return false;

  if (text === "/start") {
    await getRedis().del(mkey(chatId));
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
      text: `🤖 <b>Aura Bot LIVE hai!</b>\n\n⚡ <b>Instant Post ON</b> - Queue / Cron band hai\n📸 Manual mode: ON (Photo + Naam + Price se kaam)\n\n1️⃣ 📸 Product ki <b>photo bhejo</b>\n2️⃣ 📝 Naam likho\n3️⃣ 💰 Price likho\n4️⃣ Niche ka button dabao\n5️⃣ Video 5 min me Telegram + Instagram pe post 🚀`,
    });
    return false;
  }

  if (text === "/status") {
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `⚡ Instant Mode ON - Queue band hai\nNiche dabate hi sidha post hoga, Queue check karne ki zarurat nahi.` });
    return false;
  }

  const m = await getRedis().get(mkey(chatId));
  if (m && m.step === "title") {
    m.title = text.slice(0, 200);
    m.step = "price";
    await getRedis().set(mkey(chatId), m, { ex: 600 });
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `📝 <b>Naam save!</b>\n\n💰 Ab <b>price</b> likho (jaise ₹499) ya <b>skip</b> likho:` });
    return false;
  }
  if (m && m.step === "price") {
    m.price = text.toLowerCase() === "skip" ? "" : text.slice(0, 50);
    await getRedis().del(mkey(chatId));
    await finishManualProduct(chatId, m);
    return false;
  }
  if (m && m.step === "photo") {
    await tg("sendMessage", { chat_id: chatId, text: "📸 Pehle product ki photo bhejo (text nahi)." });
    return false;
  }

  const asin = extractASIN(text);
  if (!asin) {
    await getRedis().set(mkey(chatId), { step: "price", title: text.slice(0, 200), photoUrl: "" }, { ex: 600 });
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `📝 <b>Naam save!</b> - ${text.slice(0, 100)}\n\n📸 Ab product ki <b>photo bhejo</b> ya 💰 <b>price</b> likho:` });
    return false;
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
    if (e.userMessage) {
      await getRedis().set(mkey(chatId), { step: "photo", asin, url: text }, { ex: 600 });
      await tg("sendMessage", {
        chat_id: chatId, parse_mode: "HTML",
        text: `⚠️ <b>Amazon abhi block kar raha hai.</b>\n\n🔄 <b>Manual mode ON:</b>\n\n📸 Product ki <b>photo bhejo</b>`,
      });
      return false;
    }
    throw e;
  }
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("Aura bot live 🤖");
  const update = req.body || {};
  const chatId = (update.message && update.message.chat && update.message.chat.id) ||
                 (update.callback_query && update.callback_query.message && update.callback_query.message.chat.id);
  try {
    await handleUpdate(update);
  } catch (e) {
    console.error("webhook error:", e && e.message);
    if (chatId) {
      const msg = e.userMessage || ("⚠️ Error: " + String((e && e.message) || e).slice(0, 250));
      try { await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: msg }); } catch (_) {}
    }
  }
  return res.status(200).send("ok");
};
