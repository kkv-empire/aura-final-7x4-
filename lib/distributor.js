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

async function distribute(product) {
  const results = {};
  const niche = nicheConf(product.niche);

  // 1. Video render
  const videoPath = await renderSlideshow(product.images);

  // 2. Telegram pe upload → public file URL (IG/Wix ke liye)
  const tgCaption = buildCaption(product, "telegram");
  const videoUrl = await uploadVideoGetUrl(videoPath, tgCaption);

  // 3. Chaaron platforms (jo fail ho, baaki chalte rahen)
  const jobs = {
    telegram: () => postToChannel(niche.tg_channel || niche.telegram, videoPath, tgCaption),
    instagram: () =>
      postReel(niche.ig_user_id, process.env[`IG_TOKEN_${product.niche.toUpperCase()}`] || process.env.IG_PAGE_TOKEN, videoUrl, buildCaption(product, "instagram")),
    youtube: () =>
      uploadShort(product.niche, videoPath,
        `${product.title} | ${product.niche}`.slice(0, 100),
        `${product.title}\n\n👉 ${product.affiliate_link}\n\n${DISCLOSURE}`),
    wix: () => publishPost(product.niche, product.title, buildWixHtml(product)),
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
