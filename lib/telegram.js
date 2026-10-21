// lib/telegram.js — Telegram: admin alerts + channel posting
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
// (IG/Wix me video_url ke kaam aata hai)
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

module.exports = { sendMessage, notifyAdmin, uploadVideoGetUrl, postToChannel };
