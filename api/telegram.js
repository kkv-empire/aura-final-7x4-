// api/telegram.js — MANUAL ENTRY version (Rasta 2)
// Amazon scraping/API band — user khud title, price, photo bhejta hai.
// Baaki flow same: niche button → queue → cron → video → 4 platforms.

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

// ---- MANUAL FLOW: title → price → photo(s) → DONE ----
async function handleManual(chatId, msg, text, pending) {
  const r = getRedis();

  // Beech me naya link aaya to purana flow discard, naya shuru
  const newAsin = extractASIN(text);
  if (newAsin && newAsin !== pending.asin) {
    await r.set(pkey(chatId), { manual: true, asin: newAsin, step: "title" }, { ex: 600 });
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `🔗 Naya link mil gaya! Purani entry hata di.\n\n📝 <b>Step 1/3:</b> Product ka <b>title</b> bhejo\n(Amazon app se copy karke paste kar do)`,
    });
    return;
  }

  if (pending.step === "title") {
    if (!text) {
      await tg("sendMessage", { chat_id: chatId, text: "📝 Pehle product ka title bhejo (text me likhke)." });
      return;
    }
    pending.title = text.slice(0, 200);
    pending.step = "price";
    await r.set(pkey(chatId), pending, { ex: 600 });
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `✅ Title save ho gaya!\n\n💰 <b>Step 2/3:</b> Product ka <b>price</b> bhejo (jaise ₹1,299)`,
    });
    return;
  }

  if (pending.step === "price") {
    if (!text) {
      await tg("sendMessage", { chat_id: chatId, text: "💰 Price text me bhejo (jaise ₹1,299)." });
      return;
    }
    pending.price = text.slice(0, 40);
    pending.step = "photo";
    pending.images = [];
    await r.set(pkey(chatId), pending, { ex: 600 });
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `✅ Price save ho gaya!\n\n🖼️ <b>Step 3/3:</b> Product ki <b>photo</b> bhejo (gallery se)\n\n• Max <b>4 photos</b> — ek-ek karke bhejo\n• Ho jaye to <b>DONE</b> likho`,
    });
    return;
  }

  if (pending.step === "photo") {
    if (msg.photo && msg.photo.length) {
      if (pending.images.length >= 4) {
        await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: "4 photos ho gayi ✅ — ab <b>DONE</b> likho." });
        return;
      }
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const gf = await tg("getFile", { file_id: fileId });
      const fpath = gf && gf.result && gf.result.file_path;
      if (!fpath) throw new Error("photo download fail");
      const dl = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${fpath}`);
      if (!dl.ok) throw new Error("photo download fail");
      const buf = Buffer.from(await dl.arrayBuffer());
      pending.images.push("data:image/jpeg;base64," + buf.toString("base64"));
      await r.set(pkey(chatId), pending, { ex: 600 });
      await tg("sendMessage", {
        chat_id: chatId, parse_mode: "HTML",
        text: `✅ Photo ${pending.images.length} mili — aur bhejo ya <b>DONE</b> likho`,
      });
      return;
    }
    if (text.toLowerCase() === "done") {
      if (!pending.images.length) {
        await tg("sendMessage", { chat_id: chatId, text: "🖼️ Pehle kam se kam 1 photo to bhejo!" });
        return;
      }
      const tag = process.env.AMAZON_TAG || "";
      const url = `https://www.amazon.in/dp/${pending.asin}`;
      const p = {
        asin: pending.asin,
        title: pending.title,
        price: pending.price,
        images: pending.images,
        features: [],
        amazon_link: url,
        affiliate_link: tag ? `${url}?tag=${tag}` : url,
      };
      await r.set(pkey(chatId), p, { ex: 600 });
      await tg("sendMessage", {
        chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
        text: `📦 <b>${String(p.title).slice(0, 120)}</b>\n💰 ${p.price}\n🖼️ ${p.images.length} photo(s)\n\n👇 Niche chuno:`,
        reply_markup: { inline_keyboard: nicheButtons(pending.asin) },
      });
      return;
    }
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: "🖼️ Photo bhejo ya <b>DONE</b> likho." });
    return;
  }
}

async function handleUpdate(update) {
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const parts = String(cb.data || "").split(":");
    const asin = parts[1], niche = parts[2];
    const p = await getRedis().get(pkey(chatId));
    if (p && p.asin === asin) {
      await pushProduct({ ...p, niche });
      await getRedis().del(pkey(chatId));
      const n = await queueLength();
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Queue me daal diya ✅" });
      await tg("editMessageText", {
        chat_id: chatId, message_id: cb.message.message_id, parse_mode: "HTML",
        text: `✅ <b>${niche}</b> me save ho gaya!\n📦 ${String(p.title).slice(0, 100)}\n\n🎬 Video banke 4 platforms pe auto-post hogi.\n📊 Queue me ab: ${n} product(s)`,
      });
    } else {
      await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Session expire — link dobara bhejo" });
    }
    return;
  }

  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    const health = await healthReport();
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
      text: `🤖 <b>Aura Bot LIVE hai!</b>\n\n${health}\n\n1️⃣ Amazon.in ka product link bhejo\n2️⃣ Title, price, photo bhejo (30 sec)\n3️⃣ Niche ka button dabao\n4️⃣ Video banke 4 platforms pe auto-post 🚀\n\n📊 /status — queue dekho\n❌ /cancel — beech me entry radd karo`,
    });
    return;
  }

  if (text === "/status") {
    const n = await queueLength();
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `📊 Queue me: <b>${n}</b> product(s)` });
    return;
  }

  if (text === "/cancel") {
    await getRedis().del(pkey(chatId));
    await tg("sendMessage", { chat_id: chatId, text: "❌ Entry cancel ho gayi — naya Amazon.in link bhejo." });
    return;
  }

  // Manual flow chal raha hai to wahi handle karega
  const pending = await getRedis().get(pkey(chatId));
  if (pending && pending.manual) {
    await handleManual(chatId, msg, text, pending);
    return;
  }

  const asin = extractASIN(text);
  if (!asin) {
    await tg("sendMessage", { chat_id: chatId, text: "🔗 Amazon.in ka product link bhejo shuru karne ke liye." });
    return;
  }

  // Manual entry shuru — scraping nahi, user khud details dega
  await getRedis().set(pkey(chatId), { manual: true, asin, step: "title" }, { ex: 600 });
  await tg("sendMessage", {
    chat_id: chatId, parse_mode: "HTML",
    text: `🔗 Link mil gaya! Ab details <b>tum</b> doge (30 second ka kaam):\n\n📝 <b>Step 1/3:</b> Product ka <b>title</b> bhejo\n(Amazon app se copy karke paste kar do)`,
  });
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
      try {
        await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: msg });
      } catch (_) {}
    }
  }
  return res.status(200).send("ok");
};
