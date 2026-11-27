// lib/distributor.js - FINAL - Photo Kabhi Nahi Rukegi + Premium Video + Clickable Links
const S = "am" + "azon";
const G = "git" + "hub";
let wixMod = null;
try { wixMod = require("./wixsite"); } catch (e) { wixMod = null; }
const DISCLOSURE = "#ad | As an " + S + " Associate I earn from qualifying purchases.";
function makeClearImage(u) {
  if (!u || typeof u !== "string") return "";
  let c = u.trim();
  c = c.replace(/_SL\d+_/, "_SL2000_").replace(/_SX\d+_/, "_SX2000_").replace(/_SS\d+_/, "_SL2000_").replace(/_AC_.*?_\./, "_.");
  return c;
}
function isGoodPhoto(u) {
  if (!u || typeof u !== "string") return false;
  if (!u.startsWith("https://")) return false;
  if (u.includes("thum.io") || u.includes("screenshot")) return false;
  if (u.includes("picsum") || u.includes("placeholder") || u.includes("placehold")) return false;
  if (u.includes("play-icon") || u.includes("sprite") || u.includes("1x1") || u.includes("transparent") || u.includes("loading")) return false;
  // FIX - Microlink / Weserv ko Sabse Pehle Allow karo - Pehle ye neeche tha, isliye Reject ho rahi thi
  if (u.includes("microlink") || u.includes("images.weserv")) return true;
  if (u.includes("entity") || u.includes(" ") || u.includes("...") || u.length < 40) return false;
  const isMediaPhoto = u.includes("media-" + S) || u.includes("images/I/") || u.includes("ssl-images");
  if (!isMediaPhoto) {
    if (!u.includes(".jpg") && !u.includes(".png") && !u.includes(".webp") && !u.includes(".jpeg")) return false;
  }
  return true;
}
function buildCaption(p) {
  const shortTitle = (p.title || "").slice(0, 80);
  const feats = (Array.isArray(p.features) ? p.features : []).slice(0, 2).map((f) => "✨ " + String(f).slice(0, 60)).join("\n");
  const link = p.affiliate_link || p.amazon_link || "";
  let c = link + "\n\n";
  c += "🛍️ " + shortTitle + "\n\n";
  if (p.price) c += "💰 Price: " + p.price + "\n\n";
  if (feats) c += feats + "\n\n";
  c += DISCLOSURE + "\n\n#" + p.niche + " #amazonfinds #onlineshoppingindia";
  if (c.length > 1000) c = c.slice(0, 1000);
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
    const clearUrl = makeClearImage(image_url);
    const igCreds = getIgCreds(niche);
    const priceMatch = (caption || "").match(/Price: [^\n]+/);
    const priceText = priceMatch ? priceMatch[0] : "Best Price";
    const res = await fetch("https://api." + G + ".com/repos/" + repo + "/actions/workflows/make-video.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd." + G + "+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { image_url: clearUrl, title: title || "", asin: asin || "TEST", niche: niche || "aivendora", caption: caption || "", ig_id: igCreds.igId || "", ig_token: igCreds.igToken || "", price: priceText } }),
    });
    return res.status;
  } catch (e) { return 0; }
}
async function distribute(product) {
  const results = {};
  const caption = buildCaption(product);
  const link = product.affiliate_link || product.amazon_link || "";
  let videoUrl = "";
  const allImages = product.images || [];
  // STEP 1 - Amazon Media Image
  for (const img of allImages) {
    const clear = makeClearImage(img);
    if (isGoodPhoto(clear) && (clear.includes("media-" + S) || clear.includes("images/I/"))) { videoUrl = clear; break; }
  }
  // STEP 2 - Koi bhi Good Photo
  if (!videoUrl) {
    for (const img of allImages) {
      const clear = makeClearImage(img);
      if (isGoodPhoto(clear)) { videoUrl = clear; break; }
    }
  }
  // STEP 3 - FIX - Microlink se Image - Filter ke Bina Direct lo - Agar amzn.js se Image nahi aayi to bhi Video banega
  if (!videoUrl) {
    try {
      const ogRes = await fetch("https://api.microlink.io/?url=" + encodeURIComponent("https://www." + S + ".in/dp/" + product.asin) + "&meta=false&embed=image.url&screenshot=false");
      const ogJson = await ogRes.json();
      const ogImg = ogJson && ogJson.data && ogJson.data.image && ogJson.data.image.url ? ogJson.data.image.url : "";
      if (ogImg && ogImg.startsWith("https://") && ogImg.length > 40) videoUrl = makeClearImage(ogImg);
    } catch (e) {}
  }
  // STEP 4 - FIX - Agar abhi bhi nahi mili to Pehli wali Image hi le lo - Kabhi Khali mat chhodo
  if (!videoUrl && allImages.length > 0) {
    const first = String(allImages[0] || "");
    if (first.startsWith("https://")) videoUrl = makeClearImage(first);
  }
  // STEP 5 - FIX - Agar abhi bhi nahi mili to Telegram Preview Image ka Wait mat karo - Wix wali Image se kaam chalao
  if (!videoUrl) {
    try {
      const ogRes2 = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(link) + "&meta=false&embed=image.url");
      const ogJson2 = await ogRes2.json();
      const ogImg2 = ogJson2 && ogJson2.data && ogJson2.data.image && ogJson2.data.image.url ? ogJson2.data.image.url : "";
      if (ogImg2 && ogImg2.startsWith("https://")) videoUrl = ogImg2;
    } catch (e) {}
  }
  if (videoUrl) product.images = [videoUrl];
  let ghStatus = 0;
  if (videoUrl) { ghStatus = await triggerVideo(videoUrl, product.title, product.asin || "TEST", product.niche, caption); }
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
    results.telegram = "telegram OK - " + product.niche + " | Real Image + Real Price + Clickable Link";
  } catch (e) { results.telegram = "FAIL: " + String(e.message || e).slice(0, 200); }
  try {
    if (!videoUrl) throw new Error("Asli Photo nahi mili");
    if (ghStatus === 204) { results.instagram = "instagram QUEUED - Premium Reels GH se ban rahi hai | Real Image + Real Price + Link in Bio"; }
    else { results.instagram = "instagram FAIL - GH Dispatch " + ghStatus + " | Reels Start nahi hui"; }
  } catch (e) { results.instagram = "FAIL: " + String(e.message || e).slice(0, 200); }
  try {
    if (ghStatus === 204) { results.youtube = "YT READY - Premium Shorts ban raha hai | Real Image + Real Price + Comment me Clickable Link"; }
    else { results.youtube = "YT FAIL - GH Dispatch " + ghStatus + " | " + product.niche + " | Run Start nahi hui"; }
  } catch (e) { results.youtube = "FAIL - " + String(e.message || e).slice(0, 200); }
  try {
    if (!wixMod) throw new Error("wixsite.js File lib Folder me nahi mili");
    const w = await wixMod.wixCreateProduct(product, product.niche);
    if (w && w.ok) results.wix = " WIX OK - Store Product | Real Image + Real Price + Clickable Link | " + (w.id || "");
    else results.wix = " WIX FAIL - Reason: " + String((w && w.reason) || "Unknown").slice(0, 300);
  } catch (e) { results.wix = " WIX FAIL - Reason: " + String(e.message || e).slice(0, 300); }
  return results;
}
module.exports = { distribute, buildCaption, DISCLOSURE };
