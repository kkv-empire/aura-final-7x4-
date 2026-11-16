// lib/telegram.js — Telegram: admin alerts + channel posting + INSTANT post (no queue)
const fs = require("fs");

const TOKEN = process.env.TG_BOT_TOKEN;
const ADMIN = process.env.TG_ADMIN_ID;
const api = (m) => `https://api.telegram.org/bot${TOKEN}/${m}`;

async function tg(method, body, isForm) {
  const r = await fetch(api(method), {
    method: "POST",
    ...(isForm ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  return r.json();
}

const sendMessage = (chat_id, text) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true });

const notifyAdmin = (text) => (ADMIN ? sendMessage(ADMIN, text) : Promise.resolve());

// Video file ko Telegram pe upload karke public file URL nikaalo
// (【entity-IG¦canonical_name=IG】/【entity-Wix¦canonical_name=Wix】 me video_url ke kaam aata hai)
async function uploadVideoGetUrl(videoPath, caption = "") {
  const form = new FormData();
  form.append("chat_id", ADMIN);
  form.append("video", new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }), "video.mp4");
  form.append("caption", caption.slice(0, 1024));
  form.append("disable_notification", "true");
  const res = await tg("sendVideo", form, true);
  const fileId = res?.result?.video?.file_id;
  if (!fileId) throw new Error("TG upload fail: " + JSON.stringify(res).slice(0, 200));
  const gf = await tg("getFile", { file_id: fileId });
  return `https://api.telegram.org/file/bot${TOKEN}/${gf.result.file_path}`;
}

// Niche channel me video post karo
async function postToChannel(channel, videoPath, caption) {
  const form = new FormData();
  form.append("chat_id", channel);
  form.append("video", new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }), "video.mp4");
  form.append("caption", caption.slice(0, 1024));
  form.append("parse_mode", "HTML");
  return tg("sendVideo", form, true);
}

// NAYA - Queue nahi, turant post karo - 2-3 min me 4 platform pe
// Isko api/post.js / api/webhook.js se call karo jab niche button dabe
async function postNow(product, chatId) {
  try {
    await sendMessage(chatId, "⏳ Video ban rahi hai, 2-3 min me post ho jayega...");
    // Circular require se bachne ke liye yaha require karo
    const { distribute } = require("./distributor");
    const { videoUrl, results } = await distribute(product);

    const ok = Object.entries(results).filter(([, r]) => r.ok).map(([k]) => k).join(", ");
    const fail = Object.entries(results).filter(([, r]) => !r.ok).map(([k, r]) => `❌ ${k}: ${(r.error || "").slice(0, 100)}`).join("\n");

    await sendMessage(chatId,
      `✅ Post ho gaya!\n📦 ${product.title}\n✔️ ${ok || "—"}` + (fail ? `\n${fail}` : "")
    );
    return { videoUrl, results };
  } catch (e) {
    await sendMessage(chatId, "❌ Fail ho gaya: " + String(e.message || e).slice(0, 200));
    throw e;
  }
}

module.exports = { sendMessage, notifyAdmin, uploadVideoGetUrl, postToChannel, postNow };
