// lib/distributor.js — Saaf wala, kisi aur file ko nahi bulayega
// Telegram + 【entity-Instagram¦canonical_name=Instagram】 sidha isi file se, YouTube- 【entity-Wix¦canonical_name=Wix】 baad me

const DISCLOSURE = "#ad | As an 【entity-Amazon¦canonical_name=Amazon】 Associate I earn from qualifying purchases.";

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
  return {
    igId: entry.ig_id || entry.user_id || entry.ig_user_id || "",
    igToken: entry.page_token || entry.token || entry.access_token || ""
  };
}

function getTgChatId(nicheName) {
  let tgChannels = {};
  try { tgChannels = JSON.parse(process.env.TG_CHANNELS || "{}"); } catch (e) { tgChannels = {}; }
  const key = Object.keys(tgChannels).find(function(k) { return k.toLowerCase() === (nicheName || "").toLowerCase(); });
  if (key) return tgChannels[key];
  return process.env.TG_CHANNEL_ID || process.env.TG_CHAT_ID || "";
}

async function distribute(product) {
  const results = {};
  const caption = buildCaption(product);
  const videoUrl = (product.images && product.images[0]) || "";
  if (!videoUrl) throw new Error("Photo URL nahi mili");

  // 1. TELEGRAM - Niche wise Channel
  try {
    const botToken = process.env.TG_BOT_TOKEN;
    const chatId = getTgChatId(product.niche);
    if (!botToken || !chatId) throw new Error("TG_BOT_TOKEN / TG_CHANNELS missing for " + product.niche);
    const r = await fetch("https://api.telegram.org/bot" + botToken + "/sendPhoto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: videoUrl, caption: caption }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error("Telegram fail: " + JSON.stringify(j).slice(0, 200));
    results.telegram = "telegram OK - " + product.niche;
  } catch (e) {
    results.telegram = "FAIL: " + String(e.message || e).slice(0, 200);
  }

  // 2. INSTAGRAM - Photo ko Photo ki tarah bhejo, Video ki tarah nahi
  try {
    const creds = getIgCreds(product.niche);
    const igId = creds.igId;
    const igToken = creds.igToken;
    if (!igId || !igToken) throw new Error("IG creds missing for " + product.niche);
    const igCaption = caption + "\n🔗 Link in bio";
    // IMAGE post - REELS nahi, kyunki hamare paas Photo hai, Video nahi hai
    let r = await fetch("https://graph.facebook.com/v21.0/" + igId + "/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: videoUrl, caption: igCaption, access_token: igToken }),
    });
    let j = await r.json();
    if (!j.id) throw new Error("IG container fail: " + JSON.stringify(j).slice(0, 300));
    const containerId = j.id;
    // Image ke liye 1 baar hi wait karo, 30 sec nahi
    await new Promise(function(x) { setTimeout(x, 5000); });
    r = await fetch("https://graph.facebook.com/v21.0/" + igId + "/media_publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: igToken }),
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
