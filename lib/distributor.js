// lib/distributor.js - Final - Video Trigger + Telegram + Instagram

const DISCLOSURE = "#ad | As an 【entity-amazon¦canonical_name=Amazon】 Associate I earn from qualifying purchases.";

function buildCaption(p) {
  const feats = (Array.isArray(p.features) ? p.features : []).slice(0, 3).map((f) => "✨ " + f).join("\n");
  const linkLine = "👉 Buy here: " + (p.affiliate_link || p.amazon_link || "");
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
  const map = {
    "aivendora": "@aivendora_deals",
    "trendmind": "@trendmind_deals",
    "smartshiply": "@smartshiply_deals",
    "nichepilot": "@nichepilot_deals",
    "adbrainx": "@adbrainx_deals",
    "cartflow": "@cartflow_deals",
    "globaldrop": "@globaldrop_deals"
  };
  return map[(nicheName || "").toLowerCase()] || "";
}

async function triggerVideo(image_url, title, asin) {
  try {
    const token = process.env.GH_TOKEN;
    const repo = process.env.GH_REPO;
    if (!token || !repo) return;
    await fetch("https://api.github.com/repos/" + repo + "/actions/workflows/make-video.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { image_url: image_url, title: title, asin: asin } }),
    });
  } catch (e) {}
}

async function distribute(product) {
  const results = {};
  const caption = buildCaption(product);
  const videoUrl = (product.images && product.images[0]) || "";
  if (!videoUrl) throw new Error("Photo URL nahi mili");

  // Video banane ke liye gh ko bolo - Tumko Run dabana nahi padega
  await triggerVideo(videoUrl, product.title, product.asin || "TEST");

  // 1. TELEGRAM - Username se, ID ki zarurat nahi
  try {
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = getTgChatId(product.niche);
    if (!botToken || !chatId) throw new Error("TG_BOT_TOKEN / Channel Username missing for " + product.niche);
    const r = await fetch("https://api.telegram.org/bot" + botToken + "/sendPhoto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: videoUrl, caption: caption }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error("Telegram fail: " + JSON.stringify(j).slice(0, 200));
    results.telegram = "telegram OK - " + product.niche + " | Video gh me ban raha hai";
  } catch (e) {
    results.telegram = "FAIL: " + String(e.message || e).slice(0, 200);
  }

  // 2. INSTAGRAM - Photo post, Video baad me
  try {
    const creds = getIgCreds(product.niche);
    if (!creds.igId || !creds.igToken) throw new Error("IG creds missing for " + product.niche);
    const igCaption = caption + "\n🔗 Link in bio";
    let r = await fetch("https://graph.facebook.com/v21.0/" + creds.igId + "/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: videoUrl, caption: igCaption, access_token: creds.igToken }),
    });
    let j = await r.json();
    if (!j.id) throw new Error("IG container fail: " + JSON.stringify(j).slice(0, 300));
    await new Promise(function(x) { setTimeout(x, 5000); });
    r = await fetch("https://graph.facebook.com/v21.0/" + creds.igId + "/media_publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: j.id, access_token: creds.igToken }),
    });
    j = await r.json();
    if (!j.id) throw new Error("IG publish fail: " + JSON.stringify(j).slice(0, 300));
    results.instagram = "instagram OK - " + j.id;
  } catch (e) {
    results.instagram = "FAIL: " + String(e.message || e).slice(0, 200);
  }

  results.youtube = "SKIPPED - Baad me karenge";
  results.wix = "SKIPPED - Baad me karenge";
  return results;
}

module.exports = { distribute, buildCaption, DISCLOSURE };
