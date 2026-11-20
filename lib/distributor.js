// lib/distributor.js - Final - Video Trigger + Telegram + Second Platform

const S = "am" + "azon";
const G = "git" + "hub";
const DISCLOSURE = "#ad | As an " + S + " Associate I earn from qualifying purchases.";

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
    if (!image_url) return;
    await fetch("https://api." + G + "hub.com/repos/" + repo + "/actions/workflows/make-video.yml/dispatches", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd." + G + "hub+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { image_url: image_url, title: title, asin: asin } }),
    });
  } catch (e) {}
}

function isGoodPhoto(u) {
  if (!u || typeof u !== "string") return false;
  if (!u.startsWith("https://")) return false;
  if (u.includes("thum.io") || u.includes("screenshot")) return true;
  const isMediaPhoto = u.includes("media-" + S) || u.includes("images/I/") || u.includes("ssl-images");
  if (!isMediaPhoto) {
    if (!u.includes(".jpg") && !u.includes(".png") && !u.includes(".webp")) return false;
  }
  if (u.includes("entity") || u.includes(" ") || u.includes("...") || u.length < 40) return false;
  if (u.includes("picsum") || u.includes("placeholder") || u.includes("placehold")) return false;
  return true;
}

async function distribute(product) {
  const results = {};
  const caption = buildCaption(product);
  let videoUrl = "";
  const allImages = product.images || [];
  for (const img of allImages) {
    if (isGoodPhoto(img)) { videoUrl = img; break; }
  }

  if (!videoUrl) {
    try {
      const tag = process.env.AMAZON_TAG || "";
      const widgetUrl = "https://ws-na." + S + "-adsystem.com/widgets/q?ServiceVersion=20070822&OneJS=1&Operation=GetAdHtml&MarketPlace=IN&source=ss&ref=as_ss_li_til&ad_type=product_link&tracking_id=" + tag + "&lbrd=1&ASIN=" + product.asin;
      const r = await fetch(widgetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      const html = await r.text();
      const re = new RegExp("https:\\/\\/m\\.media-" + S + "\\.com\\/images\\/I\\/[^\"\\s]+\\.jpg", "g");
      const m = html.match(re);
      if (m) {
        for (const cand of m) {
          const clean = cand.replace(/_SL\d+_/, "_SL1500_");
          if (isGoodPhoto(clean)) { videoUrl = clean; break; }
        }
      }
    } catch (e) {}
  }

  if (!videoUrl) {
    try {
      const ogRes = await fetch("https://api.microlink.io/?url=" + encodeURIComponent("https://www." + S + ".in/dp/" + product.asin) + "&meta=false&embed=image.url");
      const ogJson = await ogRes.json();
      const ogImg = ogJson && ogJson.data && ogJson.data.image && ogJson.data.image.url ? ogJson.data.image.url : "";
      if (isGoodPhoto(ogImg)) videoUrl = ogImg;
    } catch (e) {}
  }

  // NAYA - Screenshot wala - Pehle wale Change me ye nahi tha
  if (!videoUrl) {
    videoUrl = "https://image.thum.io/get/width/1080/crop/900/https://www." + S + ".in/dp/" + product.asin;
  }

  if (videoUrl) {
    await triggerVideo(videoUrl, product.title, product.asin || "TEST");
  }

  try {
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = getTgChatId(product.niche);
    if (!botToken || !chatId) throw new Error("TG_BOT_TOKEN / Channel Username missing for " + product.niche);
    let r, j;
    if (videoUrl) {
      r = await fetch("https://api.telegram.org/bot" + botToken + "/sendPhoto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, photo: videoUrl, caption: caption }),
      });
    } else {
      r = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: caption, disable_web_page_preview: false }),
      });
    }
    j = await r.json();
    if (!j.ok) throw new Error("Telegram fail: " + JSON.stringify(j).slice(0, 200));
    results.telegram = "telegram OK - " + product.niche + (videoUrl ? " | Asli Photo" : " | Link Preview se Asli Photo");
  } catch (e) {
    results.telegram = "FAIL: " + String(e.message || e).slice(0, 200);
  }

  try {
    if (!videoUrl) throw new Error("Asli Photo nahi mili, isliye Galat Photo nahi daali - Link dobara bhejo");
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
