// lib/distributor.js — 1 product → 4 platforms (platform rules safe)
// Har platform pe: #ad disclosure + affiliate link (jaha clickable ho)
const { renderSlideshow } = require("./video");
const { uploadVideoGetUrl, postToChannel } = require("./telegram");
const { postReel } = require("./instagram");
const { uploadShort } = require("./youtube");
const { publishPost } = require("./【entity-wix¦canonical_name=Wix】");

const DISCLOSURE = "#ad | As an 【entity-Amazon¦canonical_name=Amazon】 Associate I earn from qualifying purchases.";

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
    `<p><a href="${p.affiliate_link}">👉 Buy on Amazon</a></p>` +
    `<p><small>${DISCLOSURE}</small></p>`
  );
}

// Niche config: config/niches.json se aata hai (tumhara existing format)
function nicheConf(nicheName) {
  const cfg = require("../config/niches.json");
  const list = Array.isArray(cfg) ? cfg : cfg.niches || [];
  return list.find((n) => n.name === nicheName) || {};
}

// IG_FB_JSON se 7 niche ka token + ID nikalne ke liye - 1 JSON me 7 niche
function getIgCreds(nicheName, niche) {
  let igMap = {};
  try { igMap = JSON.parse(process.env.IG_FB_JSON || '{}'); } catch {}
  // niche naam lowercase me bhi check karo, taaki naam galat hone pe bhi chale
  const entry = igMap[nicheName] || igMap[nicheName.toLowerCase()] || igMap[nicheName.toUpperCase()] || {};
  const igId = entry.ig_id || entry.user_id || entry.ig_user_id || niche.ig_user_id;
  const igToken = entry.token || entry.access_token || entry.page_token || process.env[`IG_TOKEN_${nicheName.toUpperCase()}`] || process.env.IG_PAGE_TOKEN;
  return { igId, igToken };
}

async function distribute(product) {
  const results = {};
  const niche = nicheConf(product.niche);

  // 1. Video render
  const videoPath = await renderSlideshow(product.images);

  // 2. Telegram pe upload → public file URL (【entity-IG¦canonical_name=IG】/【entity-Wix¦canonical_name=Wix】 ke liye)
  const tgCaption = buildCaption(product, "telegram");
  const videoUrl = await uploadVideoGetUrl(videoPath, tgCaption);

  // 3. Chaaron platforms (jo fail ho, baaki chalte rahen)
  const jobs = {
    telegram: () => postToChannel(niche.tg_channel || niche.telegram, videoPath, tgCaption),
    instagram: () => {
      const { igId, igToken } = getIgCreds(product.niche, niche);
      return postReel(igId, igToken, videoUrl, buildCaption(product, "instagram"));
    },
    youtube: () =>
      uploadShort(product.niche, videoPath,
        `${product.title} | ${product.niche}`.slice(0, 100),
        `${product.title}\n\n👉 ${product.affiliate_link}\n\n${DISCLOSURE}`),
    【entity-wix¦canonical_name=Wix】: () => publishPost(product.niche, product.title, buildWixHtml(product)),
  };

  for (const [platform, fn] of Object.entries(jobs)) {
    try {
      results[platform] = { ok: true, id: await fn() };
    } catch (e) {
      results[platform] = { ok: false, error: String(e.message || e).slice(0, 200) };
    }
  }
  return { videoUrl, results };
}

module.exports = { distribute, buildCaption, DISCLOSURE };
