// lib/distributor.js - FINAL - Clear Image + Clickable Link + Video
const S = "am" + "azon";
const G = "git" + "hub";
let publishPost = null;
try { publishPost = require("./wixsite").publishPost; } catch (e) { publishPost = null; }
const DISCLOSURE = "#ad | As an " + S + " Associate I earn from qualifying purchases.";

// Clear Image banao - Chhoti Image ko Badi karo - _SL150_ -> _SL1500_
function makeClearImage(u) {
  if (!u || typeof u !== "string") return "";
  let c = u.trim();
  c = c.replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_").replace(/_SS\d+_/, "_SL1500_").replace(/_AC_.*?_\./, "_.");
  // Microlink wali Chhoti Image ko mat lo agar 【entity-Amazon¦canonical_name=Amazon】 wali mil gayi to
  return c;
}
function isGoodPhoto(u) {
  if (!u || typeof u !== "string") return false;
  if (!u.startsWith("https://")) return false;
  if (u.includes("thum.io") || u.includes("screenshot")) return false;
  if (u.includes("picsum") || u.includes("placeholder") || u.includes("placehold")) return false;
  if (u.includes("play-icon") || u.includes("sprite") || u.includes("1x1") || u.includes("transparent") || u.includes("loading")) return false;
  if (u.includes("entity") || u.includes(" ") || u.includes("...") || u.length < 40) return false;
  const isMediaPhoto = u.includes("media-" + S) || u.includes("images/I/") || u.includes("ssl-images");
  if (!isMediaPhoto) {
    // Microlink OG Image - Sirf tab lo jab Amazon wali na mile, wo Chhoti hoti hai
    if (u.includes("microlink") || u.includes("images.weserv")) return true;
    if (!u.includes(".jpg") && !u.includes(".png") && !u.includes(".webp")) return false;
  }
  return true;
}
function buildCaption(p) {
  const feats = (Array.isArray(p.features) ? p.features : []).slice(0, 3).map((f) => "✨ " + f).join("\n");
  const link = p.affiliate_link || p.amazon_link || "";
  const linkLine = "👉 Buy here: " + link;
  let c = "🛍️ " + p.title + "\n\n";
  if (p.price) c += "💰 Price: " + p.price + "\n\n";
  if (feats) c += feats + "\n\n";
  c += linkLine + "\n\n" + DISCLOSURE + "\n\n#" + p.niche + " #amazonfinds #onlineshoppingindia";
  return c;
}
function getIgCreds(nicheName) {
  let igMap = {};
  try { igMap = JSON.parse(process.env.IG_FB_JSON || "{}"); } catch (e) { igMap = {}; }
  const key = Object.keys(igMap).find(function(k) { return k.toLowerCase() === (nicheName || "").toLowerCase(); });
  const entry = key ? igMap[key] : {};
  return { igId: entry.ig_id || "", igToken: entry.page_token || entry.token || "" };
}
function getTgChatId(nicheName) {
  const map = { "aivendora": "@aivendora_deals", "trendmind": "@trendmind_deals", "smartshiply": "@smartshiply_deals", "nichepilot": "@nichepilot_deals", "adbrainx": "@adbrainx_deals", "cartflow": "@cartflow_deals", "globaldrop": "@globaldrop_deals" };
  return map[(nicheName || "").toLowerCase()] || "";
}
async function triggerVideo(image_url, title, asin, niche, caption) {
  try {
    const token = process.env.GH_TOKEN;
    const repo = process.env.GH_REPO;
    if (!token) return 0;
    if (!repo) return 0;
    if (!image_url) return 0;
    // Clear Image hi Video me bhejo - Blur wali nahi
    const clearUrl = makeClearImage(image_url);
    const res = await fetch("https://api." + G + ".com/repos/" + repo + "/actions/workflows/make-video.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd." + G + "+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { image_url: clearUrl, title: title || "", asin: asin || "TEST", niche: niche || "aivendora", caption: caption || "" } }),
    });
    return res.status;
  } catch (e) { return 0; }
}
async function distribute(product) {
  const results = {};
  const caption = buildCaption(product);
  const link = product.affiliate_link || product.amazon_link || "";
  // 1. Clear Image - Pehle Amazon hiRes, Fir Widget, Fir Microlink (Aakhri)
  let videoUrl = "";
  const allImages = product.images || [];
  // Amazon hiRes wali pehle - Clear hogi
  for (const img of allImages) {
    const clear = makeClearImage(img);
    if (isGoodPhoto(clear) && (clear.includes("media-" + S) || clear.includes("images/I/"))) { videoUrl = clear; break; }
  }
  if (!videoUrl) {
    for (const img of allImages) {
      const clear = makeClearImage(img);
      if (isGoodPhoto(clear)) { videoUrl = clear; break; }
    }
  }
  if (!videoUrl) {
    try {
      const tag = process.env.AMAZON_TAG || "";
      const widgetUrl = "https://ws-na." + S + "-adsystem.com/widgets/q?ServiceVersion=20070822&OneJS=1&Operation=GetAdHtml&MarketPlace=IN&source=ss&ref=as_ss_li_til&ad_type=product_link&tracking_id=" + tag + "&lbrd=1&ASIN=" + product.asin;
      const r = await fetch(widgetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await r.text();
      const re = new RegExp("https:\\/\\/m\\.media-" + S + "\\.com\\/images\\/I\\/[^\"\\s]+\\.jpg", "g");
      const m = html.match(re);
      if (m) { for (const cand of m) { const clean = makeClearImage(cand); if (isGoodPhoto(clean)) { videoUrl = clean; break; } } }
    } catch (e) {}
  }
  if (!videoUrl) {
    try {
      const ogRes = await fetch("https://api.microlink.io/?url=" + encodeURIComponent("https://www." + S + ".in/dp/" + product.asin) + "&meta=false&embed=image.url");
      const ogJson = await ogRes.json();
      const ogImg = ogJson && ogJson.data && ogJson.data.image && ogJson.data.image.url ? ogJson.data.image.url : "";
      if (isGoodPhoto(ogImg)) videoUrl = makeClearImage(ogImg);
    } catch (e) {}
  }
  // Thumb kabhi nahi - Agar Image nahi mili to khali chhodo
  let ghStatus = 0;
  if (videoUrl) { ghStatus = await triggerVideo(videoUrl, product.title, product.asin || "TEST", product.niche, caption); }

  // Telegram - Link Clickable ✅ - Photo + Caption me Link
  try {
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = getTgChatId(product.niche);
    if (!botToken || !chatId) throw new Error("TG_BOT_TOKEN / Channel Username missing for " + product.niche);
    let r, j;
    if (videoUrl) {
      r = await fetch("https://api.telegram.org/bot" + botToken + "/sendPhoto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, photo: videoUrl, caption: caption }) });
    } else {
      r = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: caption, disable_web_page_preview: false }) });
    }
    j = await r.json();
    if (!j.ok) throw new Error("Telegram fail: " + JSON.stringify(j).slice(0, 200));
    results.telegram = "telegram OK - " + product.niche + (videoUrl ? " | Asli Photo" : " | Link Preview se Asli Photo");
  } catch (e) { results.telegram = "FAIL: " + String(e.message || e).slice(0, 200); }

  // Instagram - Caption Link Clickable nahi hota, isliye Link in Bio ✅
  try {
    if (!videoUrl) throw new Error("Asli Photo nahi mili");
    const creds = getIgCreds(product.niche);
    if (!creds.igId || !creds.igToken) throw new Error("IG creds missing for " + product.niche);
    const igCaption = caption + "\n🔗 Link in bio";
    let r = await fetch("https://graph.facebook.com/v21.0/" + creds.igId + "/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: videoUrl, caption: igCaption, access_token: creds.igToken }) });
    let j = await r.json();
    if (!j.id) throw new Error("IG container fail: " + JSON.stringify(j).slice(0, 300));
    await new Promise(function(x) { setTimeout(x, 5000); });
    r = await fetch("https://graph.facebook.com/v21.0/" + creds.igId + "/media_publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: j.id, access_token: creds.igToken }) });
    j = await r.json();
    if (!j.id) throw new Error("IG publish fail: " + JSON.stringify(j).slice(0, 300));
    results.instagram = "instagram OK - " + j.id;
  } catch (e) { results.instagram = "FAIL: " + String(e.message || e).slice(0, 200); }

  // YouTube - Description me Link Clickable ✅ - Caption GH ko bheja, GH Description me daalega
  try {
    const nicheUp = (product.niche || "").toUpperCase();
    const refresh = process.env["YT_" + nicheUp] || "";
    const cid = process.env.YT_CLIENT_ID || "";
    const csec = process.env.YT_CLIENT_SECRET || "";
    if (refresh.length > 50 && cid.length > 10 && csec.length > 10) {
      if (ghStatus === 204) { results.youtube = "YT READY - " + product.niche + " | Video GH me ban raha hai | Desc me Link Clickable"; }
      else { results.youtube = "YT FAIL - GH Dispatch " + ghStatus + " | " + product.niche + " | Run Start nahi hui"; }
    } else { results.youtube = "SKIPPED - YT Creds nahi hai " + product.niche; }
  } catch (e) { results.youtube = "FAIL - " + String(e.message || e).slice(0, 200); }

  // Wix - Description me Link - Site pe Blue + Clickable ✅
  try {
    if (!publishPost) throw new Error("wixsite.js File lib Folder me nahi mili - Reason: File Missing");
    const wixUrl = await publishPost(product.niche, product.title, caption, videoUrl, link, product);
    results.wix = " WIX OK - " + product.niche + " | " + wixUrl;
  } catch (e) { results.wix = " WIX FAIL - Reason: " + String(e.message || e).slice(0, 200); }
  return results;
}
module.exports = { distribute, buildCaption, DISCLOSURE };
