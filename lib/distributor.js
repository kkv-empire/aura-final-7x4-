// lib/distributor.js — 1 product → 4 platforms (platform rules safe)
// Har platform pe: #ad disclosure + affiliate link (jaha clickable ho)
const { renderSlideshow } = require("./video");
const { uploadVideoGetUrl, postToChannel } = require("./telegram");
const { postReel } = require("./instagram");
const { uploadShort } = require("./youtube");
const { publishPost } = require("./wix");

const DISCLOSURE = "#ad | As an Amazon Associate I earn from qualifying purchases.";

function buildCaption(p, platform) {
  const feats = (Array.isArray(p.features) ? p.features : []).slice(0, 3).map((f) => `✨ ${f}`).join("\n");
  const linkLine =
    platform === "instagram"
      ? `🔗 Link in bio (copy): ${p.affiliate_link}`
      : `👉 Buy here: ${p.affiliate_link}`;
  return (
    `🛍️ ${p.title}\n\n` +
    (p.price ? `💰 Price: ${p.price}\n\n` : "") +
    (feats ? feats + "\n\n" : "") +
    linkLine + `\n\n${DISCLOSURE}\n\n` +
    `#${p.niche} #amazonfinds #onlineshoppingindia`
  );
}

function buildWixHtml(p) {
  const feats = (Array.isArray(p.features) ? p.features : []).map((f) => `<li>${f}</li>`).join("");
  return (
    `<h2>${p.title}</h2>` +
    (p.price ? `<p><strong>Price: ${p.price}</strong></p>` : "") +
    (feats ? `<ul>${feats}</ul>` : "") +
    `<p><a href="${p.affiliate_link}">👉 Buy on 【entity-Amazon¦canonical_name=Amazon】</a></p>` +
    `<p><small>${DISCLOSURE}</small></p>`
  );
}

// Niche config: config/niches.json se aata hai
function nicheConf(nicheName) {
  const cfg = require("../config/niches.json");
  const list = Array.isArray(cfg) ? cfg : cfg.niches || [];
  // Naam case-insensitive match - Adbrainx / adbrainx / ADBRAINX sab chalega
  return list.find((n) => (n.name || "").toLowerCase() === (nicheName || "").toLowerCase()) || {};
}

// IG_FB_JSON se 7 niche ka token + ID - 1 JSON me 7 niche
function getIgCreds(nicheName, niche) {
  let igMap = {};
  try { igMap = JSON.parse(process.env.IG_FB_JSON || '{}'); } catch (e) { console.log("IG_FB_JSON parse fail:", e.message); }
  // niche naam har case me check karo
  const key = Object.keys(igMap).find(k => k.toLowerCase() === (nicheName || "").toLowerCase());
  const entry = key ? igMap[key] : {};
  const igId = entry.ig_id || entry.user_id || entry.ig_user_id || niche.ig_user_id || niche.ig_id;
  const igToken = entry.token || entry.access_token || entry.page_token || process.env[`IG_TOKEN_${(nicheName || "").toUpperCase()}`] || process.env.IG_PAGE_TOKEN;
  console.log(`[IG] niche=${nicheName} igId=${igId ? String(igId).slice(0,6)+"..." : "MISSING"} token=${igToken ? "OK" : "MISSING"}`);
  return { igId, igToken };
}

async function distribute(product) {
  const results = {};
  const niche = nicheConf(product.niche);
  console.log(`[DISTRIBUTE] niche=${product.niche} title=${product.title}`);

  // 1. Video render
  let videoPath;
  try {
    videoPath = await renderSlideshow(product.images);
  } catch (e) {
    console.log("[VIDEO] render fail:", e.message);
    // Video nahi bana to images[0] se hi kaam chalao, queue mat roko
    videoPath = product.images && product.images[0];
  }

  // 2. Telegram pe upload → public file URL (IG/Wix ke liye)
  const tgCaption = buildCaption(product, "telegram");
  let videoUrl = "";
  try {
    videoUrl = await uploadVideoGetUrl(videoPath, tgCaption);
  } catch (e) {
    console.log("[TELEGRAM-UPLOAD] fail:", e.message);
    videoUrl = videoPath; // fallback
  }

  // 3. Chaaron platforms - jo fail ho, baaki chalte rahen
  // YouTube / Wix agar token nahi hai to skip karo, Instagram mat roko
  const jobs = {
    telegram: () => postToChannel(niche.tg_channel || niche.telegram, videoPath, tgCaption),
    instagram: () => {
      const { igId, igToken } = getIgCreds(product.niche, niche);
      if (!igId || !igToken) throw new Error("IG creds missing for niche " + product.niche);
      return postReel(igId, igToken, videoUrl, buildCaption(product, "instagram"));
    },
    youtube: () => {
      // YT abhi chalu nahi hai to skip
      if (!process.env.YT_REFRESH_JSON && !process.env.YT_REFRESH_TOKEN) {
        console.log("[YOUTUBE] skipped - token not set yet");
        return Promise.resolve("skipped - YT not started");
      }
      return uploadShort(product.niche, videoPath,
        `${product.title} | ${product.niche}`.slice(0, 100),
        `${product.title}\n\n👉 ${product.affiliate_link}\n\n${DISCLOSURE}`);
    },
    wix: () => {
      // Wix abhi chalu nahi hai to skip
      if (!process.env.WIX_API_KEY || !process.env.WIX_SITE_ID) {
        console.log("[WIX] skipped - key not set yet");
        return Promise.resolve("skipped - Wix not started");
      }
      return publishPost(product.niche, product.title, buildWixHtml(product));
    },
  };

  for (const [platform, fn] of Object.entries(jobs)) {
    try {
      console.log(`[JOB] start ${platform}`);
      results[platform] = { ok: true, id: await fn() };
      console.log(`[JOB] done ${platform} ok`);
    } catch (e) {
      console.log(`[JOB] fail ${platform}:`, e.message);
      results[platform] = { ok: false, error: String(e.message || e).slice(0, 300) };
    }
  }
  return { videoUrl, results };
}

module.exports = { distribute, buildCaption, DISCLOSURE };
