// api/telegram.js — Telegram webhook (Vercel serverless) — MANUAL ENTRY version
// Flow: /start → Amazon link → title → price → photo → DONE → niche buttons → Redis queue → cron
// Amazon scraping/API band — user khud details bhejta hai (Rasta 2).
const { Redis } = require("@upstash/redis");
const { extractASIN } = require("../lib/amazon");
const { pushProduct, queueLength } = require("../lib/queue");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
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

function nicheButtons(asin) {
  const rows = [];
  for (let i = 0; i < NICHES.length; i += 2) {
    const row = [{ text: NICHES[i], callback_data: `niche:${asin}:${NICHES[i]}` }];
    if (NICHES[i + 1]) row.push({ text: NICHES[i + 1], callback_data: `niche:${asin}:${NICHES[i + 1]}` });
    rows.push(row);
  }
  return rows;
}

// ---- MANUAL FLOW: title → price → photo(s) → DONE ----
async function handleManual(chatId, msg, text, pending) {
  // Beech me naya link aaya to purana flow discard, naya shuru
  const newAsin = extractASIN(text);
  if (newAsin && newAsin !== pending.asin) {
    await redis.set(pkey(chatId), { manual: true, asin: newAsin, step: "title" }, { ex: 600 });
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `🔗 Naya link mil gaya! Purani entry hata di.\n\n📝 <b>Step 1/3:</b> Product ka <b>title</b> bhejo`,
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
    await redis.set(pkey(chatId), pending, { ex: 600 });
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
    await redis.set(pkey(chatId), pending, { ex: 600 });
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
      await redis.set(pkey(chatId), pending, { ex: 600 });
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
      await redis.set(pkey(chatId), p, { ex: 600 });
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
  // --- Niche button dabaya ---
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const [, asin, niche] = String(cb.data || "").split(":");
    const p = await redis.get(pkey(chatId));
    if (p && p.asin === asin) {
      await pushProduct({ ...p, niche });
      await redis.del(pkey(chatId));
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
    await tg("sendMessage", {
      chat_id: chatId, parse_mode: "HTML",
      text: `🤖 <b>Aura Bot LIVE hai!</b>\n\n1️⃣ Amazon.in ka product link bhejo\n2️⃣ Title, price, photo bhejo (30 sec)\n3️⃣ Niche ka button dabao\n4️⃣ Video banke 4 platforms pe auto-post 🚀\n\n📊 /status — queue dekho\n❌ /cancel — entry radd karo`,
    });
    return;
  }
  if (text === "/status") {
    const n = await queueLength();
    await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text: `📊 Queue me: <b>${n}</b> product(s)` });
    return;
  }
  if (text === "/cancel") {
    await redis.del(pkey(chatId));
    await tg("sendMessage", { chat_id: chatId, text: "❌ Entry cancel — naya Amazon.in link bhejo." });
    return;
  }

  // Manual flow chal raha hai to wahi handle karega
  const pending = await redis.get(pkey(chatId));
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
  await redis.set(pkey(chatId), { manual: true, asin, step: "title" }, { ex: 600 });
  await tg("sendMessage", {
    chat_id: chatId, parse_mode: "HTML",
    text: `🔗 Link mil gaya! Ab details <b>tum</b> doge (30 second ka kaam):\n\n📝 <b>Step 1/3:</b> Product ka <b>title</b> bhejo\n(Amazon app se copy karke paste kar do)`,
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("Aura bot live 🤖");
  try {
    await handleUpdate(req.body || {});
  } catch (e) {
    console.error("webhook error:", e);
  }
  return res.status(200).send("ok");
};
