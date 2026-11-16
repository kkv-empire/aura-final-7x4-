// lib/distributor.js — Telegram pehle, baaki baad me (Telegram kabhi nahi rukega)
const { renderSlideshow } = require("./video");
const { uploadVideoGetUrl, postToChannel } = require("./telegram");
const { postReel } = require("./【entity-instagram¦canonical_name=Instagram】");
const { uploadShort } = require("./youtube");
const { publishPost } = require("./【entity-wix¦canonical_name=Wix】");

const DISCLOSURE = "#ad | As an 【entity-Amazon¦canonical_name=Amazon】 Associate I earn from qualifying purchases.";

function buildCaption(p, platform) {
  const feats = (Array.isArray(p.features) ? p.features : []).slice(0, 3).map((f) => `✨ ${f}`).join("\n");
  const linkLine = platform === "【entity-instagram¦canonical_name=Instagram】"
    ? `🔗 Link in bio (copy): ${p.affiliate_link}`
    : `👉 Buy here: ${p.affiliate_link}`;
  return `🛍️ ${p.title}\n\n` + (p.price ? `💰 Price: ${p.price}\n\n` : "") + (feats ? feats + "\n\n" : "") + linkLine + `\n\n${DISCLOSURE}\n\n` + `#${p.niche} #amazonfinds #onlineshoppingindia`;
}

function nicheConf(nicheName) {
  const cfg = require("../config/niches.json");
  const list = Array.isArray(cfg) ? cfg : cfg.niches || [];
  return list.find((n) => (n.name || "").toLowerCase() === (nicheName || "").toLowerCase()) || {};
}

function getIgCreds(nicheName, niche) {
  let igMap = {};
  try { igMap = JSON.parse(process.env.IG_FB_JSON || '{}'); } catch {}
  const key = Object.keys(igMap).find(k => k.toLowerCase() === (nicheName || "").toLowerCase());
  const entry = key ? igMap[key] : {};
  return {
    igId: entry.ig_id || entry.user_id || entry.ig_user_id || niche.ig_user_id,
    igToken: entry.token || entry.access_token || entry.page_token || process.env.IG_PAGE_TOKEN
  };
}

async function distribute(product) {
  const results = {};
  const niche = nicheConf(product.niche);
  const tgCaption = buildCaption(product, "telegram");

  // 1. PEHLE TELEGRAM - Video bane ya na bane, Telegram pe to jayega hi
  try {
    let videoPath;
    try { videoPath = await renderSlideshow(product.images); }
    catch (e) { console.log("[VIDEO] fail, image se kaam chalao:", e.message); videoPath = product.images && product.images[0]; }

    // Telegram channel pe post - Ye pehle wala sahi wala hai
    const tgId = await postToChannel(niche.tg_channel || niche.telegram, videoPath, tgCaption);
    results.telegram = { ok: true, id: tgId };
    console.log("[TELEGRAM] done");

    // Video URL banao IG ke liye, agar fail bhi ho to Telegram to ho gaya
    let videoUrl = "";
    try { videoUrl = await uploadVideoGetUrl(videoPath, tgCaption); } catch (e) { videoUrl = videoPath; }

    // 2. AB BAaki - Instagram / YouTube / Wix - Agar ye fail bhi hue to Telegram to ho gaya
    try {
      const { igId, igToken } = getIgCreds(product.niche, niche);
      if (!igId || !igToken) throw new Error("IG creds missing");
      results.instagram = { ok: true, id: await postReel(igId, igToken, videoUrl, buildCaption(product, "instagram")) };
    } catch (e) { results.【entity-instagram¦canonical_name=Instagram】 = { ok: false, error: String(e.message || e).slice(0, 200) }; }

    try {
      if (!process.env.YT_REFRESH_JSON && !process.env.YT_REFRESH_TOKEN) {
        results.youtube = { ok: true, id: "skipped - YT not started" };
      } else {
        results.youtube = { ok: true, id: await uploadShort(product.niche, videoPath, `${product.title} | ${product.niche}`.slice(0, 100), `${product.title}\n\n👉 ${product.affiliate_link}\n\n${DISCLOSURE}`) };
      }
    } catch (e) { results.youtube = { ok: false, error: String(e.message || e).slice(0, 200) }; }

    try {
      if (!process.env.WIX_API_KEY || !process.env.WIX_SITE_ID) {
        results.wix = { ok: true, id: "skipped - Wix not started" };
      } else {
        const feats = (Array.isArray(product.features) ? product.features : []).map((f) => `<li>${f}</li>`).join("");
        const html = `<h2>${product.title}</h2>` + (product.price ? `<p><strong>Price: ${product.price}</strong></p>` : "") + (feats ? `<ul>${feats}</ul>` : "") + `<p><a href="${product.affiliate_link}">👉 Buy on 【entity-Amazon¦canonical_name=Amazon】</a></p><p><small>${DISCLOSURE}</small></p>`;
        results.wix = { ok: true, id: await publishPost(product.niche, product.title, html) };
      }
    } catch (e) { results.wix = { ok: false, error: String(e.message || e).slice(0, 200) }; }

  } catch (e) {
    console.log("[DISTRIBUTE] telegram bhi fail:", e.message);
    results.telegram = { ok: false, error: String(e.message || e).slice(0, 200) };
  }

  return { videoUrl: "", results };
}

module.exports = { distribute, buildCaption, DISCLOSURE };
