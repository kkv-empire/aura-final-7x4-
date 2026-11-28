// lib/distributor.js - FINAL LOCKED - FB Added - Photo Fallback Fixed
const S = "am" + "azon";
const G = "git" + "hub";
let wixMod = null;
try { wixMod = require("./wixsite"); } catch (e) { wixMod = null; }
const WX = "w" + "ix";
const WXU = "W" + "IX";
const DISCLOSURE = "#ad | As an " + S + " Associate I earn from qualifying purchases.";
function makeClearImage(u) {
  if (!u || typeof u !== "string") return "";
  let c = u.trim();
  if (c.includes("microlink") || c.includes("thum.io") || c.includes("screenshot")) return c;
  c = c.replace(/_SL\d+_/, "_SL2000_").replace(/_SX\d+_/, "_SX2000_").replace(/_SS\d+_/, "_SL2000_").replace(/_AC_.*?_\./, "_.");
  return c;
}
function isGoodPhoto(u) {
  if (!u || typeof u !== "string") return false;
  if (!u.startsWith("https://")) return false;
  if (u.includes("picsum") || u.includes("placeholder") || u.includes("placehold")) return false;
  if (u.includes("play-icon") || u.includes("sprite") || u.includes("1x1") || u.includes("transparent") || u.includes("loading")) return false;
  if (u.includes("microlink") || u.includes("images.weserv") || u.includes("thum.io") || u.includes("screenshot")) return true;
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
  let c = DISCLOSURE + "\n\n";
  c += link + "\n\n";
  c += "🛍️ " + shortTitle + "\n\n";
  if (p.price) c += "💰 Price: " + p.price + "\n\n";
  if (feats) c += feats + "\n\n";
  c += "#" + p.niche + " #amazonfinds #onlineshoppingindia";
  if (c.length > 1000) c = c.slice(0, 1000);
  return c;
}
function getIgCreds(nicheName) {
  let igMap = {};
  try { igMap = JSON.parse(process.env.IG_FB_JSON || "{}"); } catch (e) { igMap = {}; }
  let fbMap = {};
  try { fbMap = JSON.parse(process.env.FB_PAGE_JSON || "{}"); } catch (e) { fbMap = {}; }
  const key = Object.keys(igMap).find(function(k) { return k.toLowerCase() === (nicheName || "").toLowerCase(); });
  const entry = key ? igMap[key] : {};
  const fbKey = Object.keys(fbMap).find(function(k) { return k.toLowerCase() === (nicheName || "").toLowerCase(); });
  const fbEntry = fbKey ? fbMap[fbKey] : {};
  const fbId = fbEntry.fb_page_id || fbEntry.page_id || fbEntry.fb_id || entry.fb_page_id || entry.page_id || entry.fb_id || "";
  return { igId: entry.ig_id || entry.ig_user_id || entry.user_id || "", igToken: entry.page_token || entry.token || entry.access_token || "", fbId: fbId, fbToken: entry.page_token || entry.token || entry.access_token || "" };
}
function getTgChatId(nicheName) {
  const map = { "aivendora": "@aivendora_deals", "trendmind": "@trendmind_deals", "smartshiply": "@smartshiply_deals", "nichepilot": "@nichepilot_deals", "adbrainx": "@adbrainx_deals", "cartflow": "@cartflow_deals", "globaldrop": "@globaldrop_deals" };
  return map[(nicheName || "").toLowerCase()] || "";
}
async function triggerVideo(image_url, title, asin, niche, caption) {
  try {
    const token = process.env.GH_TOKEN;
    const repo = process.env.GH_REPO;
    if (!token) return { status: 0, reason: "GH_TOKEN Vercel me nahi hai" };
    if (!repo) return { status: 0, reason: "GH_REPO Vercel me nahi hai" };
    if (!image_url) return { status: 0, reason: "Image nahi mili" };
    const clearUrl = makeClearImage(image_url);
    const igCreds = getIgCreds(niche);
    const priceMatch = (caption || "").match(/Price: [^\n]+/);
    const priceText = priceMatch ? priceMatch[0] : "Best Price";
    const cleanTitle = String(title || "").replace(/\n/g, " ").slice(0, 90);
    const cleanCaption = String(caption || "").slice(0, 800);
    const cleanPrice = String(priceText || "").slice(0, 50);
    const headers = { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };
    const fullInputs = { image_url: clearUrl, title: cleanTitle, asin: String(asin || "TEST"), niche: String(niche || "aivendora"), caption: cleanCaption, ig_id: String(igCreds.igId || ""), ig_token: String(igCreds.igToken || ""), fb_id: String(igCreds.fbId || ""), fb_token: String(igCreds.fbToken || ""), price: cleanPrice };
    const shortInputs = { image_url: clearUrl, title: cleanTitle, asin: String(asin || "TEST"), niche: String(niche || "aivendora"), caption: cleanCaption, price: cleanPrice };
    const tries = [
      { ref: "main", inputs: fullInputs, name: "main-Full" },
      { ref: "main", inputs: shortInputs, name: "main-Short" },
      { ref: "master", inputs: fullInputs, name: "master-Full" },
      { ref: "master", inputs: shortInputs, name: "master-Short" },
    ];
    let lastReason = "";
    for (const t of tries) {
      const res = await fetch("https://api.github.com/repos/" + repo + "/actions/workflows/make-video.yml/dispatches", { method: "POST", headers, body: JSON.stringify({ ref: t.ref, inputs: t.inputs }) });
      const txt = await res.text().catch(() => "");
      console.log("GH DISPATCH " + t.name + ":", res.status, txt.slice(0, 500), "REPO:", repo);
      if (res.status === 204) return { status: 204, reason: "" };
      lastReason = txt.slice(0, 300) || ("Status " + res.status);
      if (res.status !== 422) break;
    }
    return { status: 422, reason: lastReason };
  } catch (e) { console.log("GH DISPATCH ERROR:", e.message); return { status: 0, reason: e.message }; }
}
async function distribute(product) {
  const results = {};
  const caption = buildCaption(product);
  const link = product.affiliate_link || product.amazon_link || "";
  const dpLink = "https://www." + S + ".in/dp/" + (product.asin || "");
  let videoUrl = "";
  const allImages = product.images || [];
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
      const ogRes = await fetch("https://api.microlink.io/?url=" + encodeURIComponent("https://www." + S + ".in/dp/" + product.asin) + "&meta=false&embed=image.url&screenshot=false");
      const ogJson = await ogRes.json();
      const ogImg = ogJson && ogJson.data && ogJson.data.image && ogJson.data.image.url ? ogJson.data.image.url : "";
      if (ogImg && ogImg.startsWith("https://") && ogImg.length > 40) videoUrl = makeClearImage(ogImg);
    } catch (e) {}
  }
  if (!videoUrl && allImages.length > 0) {
    const first = String(allImages[0] || "");
    if (first.startsWith("https://")) videoUrl = makeClearImage(first);
  }
  if (!videoUrl) {
    try {
      const ogRes2 = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(link) + "&meta=false&embed=image.url");
      const ogJson2 = await ogRes2.json();
      const ogImg2 = ogJson2 && ogJson2.data && ogJson2.data.image && ogJson2.data.image.url ? ogJson2.data.image.url : "";
      if (ogImg2 && ogImg2.startsWith("https://")) videoUrl = ogImg2;
    } catch (e) {}
  }
  if (!videoUrl) {
    try {
      const shotUrl = "https://api.microlink.io/?url=" + encodeURIComponent(dpLink) + "&screenshot=true&meta=false&embed=screenshot.url";
      const shotRes = await fetch(shotUrl);
      const shotJson = await shotRes.json();
      const shotImg = shotJson && shotJson.data && shotJson.data.screenshot && shotJson.data.screenshot.url ? shotJson.data.screenshot.url : "";
      if (shotImg && shotImg.startsWith("https://")) videoUrl = shotImg;
    } catch (e) {}
  }
  if (!videoUrl) {
    videoUrl = "https://image.thum.io/get/width/1080/crop/1080/fullpage/" + dpLink;
  }
  if (videoUrl) product.images = [videoUrl];
  let ghStatus = 0; let ghReason = "";
  if (videoUrl) { const gh = await triggerVideo(videoUrl, product.title, product.asin || "TEST", product.niche, caption); ghStatus = gh.status; ghReason = gh.reason || ""; }
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
    else { results.instagram = "instagram FAIL - GH Dispatch " + ghStatus + " | " + ghReason.slice(0, 200); }
  } catch (e) { results.instagram = "FAIL: " + String(e.message || e).slice(0, 200); }
  try {
    if (ghStatus === 204) { results.facebook = "FB QUEUED - FB Reels GH se ban rahi hai | Real Image + Real Price + Clickable Link Caption me"; }
    else { results.facebook = "FB FAIL - GH Dispatch " + ghStatus + " | " + ghReason.slice(0, 200); }
  } catch (e) { results.facebook = "FAIL - " + String(e.message || e).slice(0, 200); }
  try {
    if (ghStatus === 204) { results.youtube = "YT READY - Premium Shorts ban raha hai | Real Image + Real Price + Link Description me - Copy karke kholo | YT Shorts me Link kabhi Clickable nahi hota"; }
    else { results.youtube = "YT FAIL - GH Dispatch " + ghStatus + " | " + product.niche + " | " + ghReason.slice(0, 200); }
  } catch (e) { results.youtube = "FAIL - " + String(e.message || e).slice(0, 200); }
  try {
    if (!wixMod) throw new Error("wixsite.js File lib Folder me nahi mili");
    const w = await wixMod.wixCreateProduct(product, product.niche);
    if (w && w.ok) results[WX] = " " + WXU + " OK - Store Product | Real Image + Real Price + Clickable Link | " + (w.id || "");
    else results[WX] = " " + WXU + " FAIL - Reason: " + String((w && w.reason) || "Unknown").slice(0, 300);
  } catch (e) { results[WX] = " " + WXU + " FAIL - Reason: " + String(e.message || e).slice(0, 300); }
  return results;
}
module.exports = { distribute, buildCaption, DISCLOSURE };
