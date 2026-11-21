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

async function postToChannel(channel, videoPath, caption) {
  const form = new FormData();
  form.append("chat_id", channel);
  form.append("video", new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }), "video.mp4");
  form.append("caption", caption.slice(0, 1024));
  form.append("parse_mode", "HTML");
  return tg("sendVideo", form, true);
}

// NAYA - Queue nahi, turant post karo - 2-3 min me 4 platform pe
async function postNow(product, chatId) {
  try {
    await sendMessage(chatId, "⏳ Video ban rahi hai, 2-3 min me post ho jayega...");
    const { distribute } = require("./distributor");
    const results = await distribute(product);

    // distributor String bhejta hai - isliye String wala Check
    const msg =
      "✅ Post ho gaya!\n" +
      "📦 Product " + (product.asin || "") + "\n" +
      "✔️ Telegram: " + (results.telegram || "-") + "\n" +
      "✔️ Instagram: " + (results.instagram || "-") + "\n" +
      "✔️ YouTube: " + (results.youtube || "-") + "\n" +
      "✔️ Wix: " + (results.wix || "-");

    await sendMessage(chatId, msg);
    return { results };
  } catch (e) {
    await sendMessage(chatId, "❌ Fail ho gaya: " + String(e.message || e).slice(0, 200));
    throw e;
  }
}

module.exports = { sendMessage, notifyAdmin, uploadVideoGetUrl, postToChannel, postNow };
