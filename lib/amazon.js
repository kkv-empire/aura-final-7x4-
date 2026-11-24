// lib/amzn.js - Link bhejte hi sab kaam, Photo maangna band
// Warranty wali Image + Price Reject karega - Sirf Asli Product ki lega

const cheerio = require("cheerio");
const S = "am" + "azon";
const SITE = "www." + S + ".in";
const IMG_HOST = "m.media-" + S + ".com";

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
];

function makeHeaders(uaIndex) {
  return {
    "User-Agent": USER_AGENTS[uaIndex % USER_AGENTS.length],
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.google.com/",
    "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"Android"',
    "Upgrade-Insecure-Requests": "1",
  };
}

function extractASIN(text) {
  const re = new RegExp(S + "\\.in\\/(?:.*\\/)?(?:dp|gp\\/product)\\/([A-Z0-9]{10})", "i");
  const m = String(text).match(re);
  if (m) return m[1].toUpperCase();
  const m2 = String(text).match(/([A-Z0-9]{10})/);
  return m2 ? m2[1].toUpperCase() : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isBadImage(u) {
  const l = String(u).toLowerCase();
  if (l.includes("onsitego") || l.includes("warranty") || l.includes("extended") || l.includes("protection") || l.includes("insurance")) return true;
  return false;
}

function isGoodPhoto(u) {
  if (!u || typeof u !== "string") return false;
  if (!u.startsWith("https://")) return false;
  if (isBadImage(u)) return false;
  const isMediaPhoto = u.includes("media-" + S) || u.includes("images/I/") || u.includes("ssl-images");
  if (!isMediaPhoto) {
    if (!u.includes(".jpg") && !u.includes(".png") && !u.includes(".webp")) return false;
  }
  if (u.includes("entity") || u.includes(" ") || u.includes("...") || u.length < 40) return false;
  if (u.includes("play-icon") || u.includes("sprite") || u.includes("1x1") || u.includes("transparent") || u.includes("loading")) return false;
  if (u.includes("picsum") || u.includes("placeholder") || u.includes("placehold")) return false;
  return true;
}

function cleanImages(html) {
  const found = [];
  const start = html.indexOf("colorImages");
  if (start !== -1) {
    const part = html.slice(start, start + 30000);
    const parts = part.split('"hiRes":"');
    for (let i = 1; i < parts.length; i++) {
      const end = parts[i].indexOf('"');
      if (end === -1) continue;
      let u = parts[i].slice(0, end);
      u = u.replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_");
      if (isGoodPhoto(u) && !found.includes(u)) found.push(u);
      if (found.length >= 3) break;
    }
    if (found.length > 0) return found.slice(0, 3);
  }
  const landIdx = html.indexOf('id="landingImage"');
  if (landIdx !== -1) {
    const landPart = html.slice(landIdx, landIdx + 2000);
    const m = landPart.match(/data-old-hires="([^"]+)"/);
    if (m && isGoodPhoto(m[1])) return [m[1].replace(/_SL\d+_/, "_SL1500_")];
  }
  const hiRes = html.match(/"hiRes":"(https:[^"]+)"/g) || [];
  for (const h of hiRes) {
    const u = h.slice(9, -1).replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_");
    if (isGoodPhoto(u) && !found.includes(u)) found.push(u);
    if (found.length >= 3) break;
  }
  return found.slice(0, 3);
}

function parsePriceFromHtml(html, $) {
  try {
    const core = $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text().trim();
    if (core && core.includes("₹")) {
      const v = parseFloat(core.replace(/[^0-9.]/g, ""));
      if (v > 300) return core;
    }
    const wholes = $(".a-price-whole").map((i, el) => $(el).text().trim().replace(/[^0-9]/g, "")).get();
    for (const w of wholes) {
      const v = parseFloat(w);
      if (v > 300) return "₹" + Number(v).toLocaleString("en-IN");
    }
    const offs = $("span.a-offscreen").map((i, el) => $(el).text().trim()).get();
    for (const o of offs) {
      if (o.includes("₹") && /₹\s*[\d,]+/.test(o)) {
        const v = parseFloat(o.replace(/[^0-9.]/g, ""));
        if (v > 300) return o;
      }
    }
  } catch (e) {}
  return "";
}

function parsePriceFromText(text) {
  try {
    const all = [...String(text).matchAll(/₹\s*([\d,]{3,}\.?\d*)/g)].map(m => parseFloat(m[1].replace(/,/g, ""))).filter(n => n > 300 && n < 100000);
    if (!all.length) return "";
    const counts = {};
    for (const n of all) counts[n] = (counts[n] || 0) + 1;
    let best = 0, bestCount = 0;
    for (const k in counts) { if (counts[k] > bestCount) { bestCount = counts[k]; best = parseFloat(k); } }
    if (best) return "₹" + Number(best).toLocaleString("en-IN");
    return "";
  } catch (e) {}
  return "";
}

async function fallbackProduct(asin) {
  const tag = process.env.AMAZON_TAG || "";
  const url = "https://" + SITE + "/dp/" + asin;
  const affiliate_link = tag ? url + "?tag=" + tag : url;
  try {
    const widgetUrl = "https://ws-na." + S + "-adsystem.com/widgets/q?ServiceVersion=20070822&OneJS=1&Operation=GetAdHtml&MarketPlace=IN&source=ss&ref=as_ss_li_til&ad_type=product_link&tracking_id=" + tag + "&lbrd=1&ASIN=" + asin;
    const r = await fetch(widgetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();
    const images = cleanImages(html);
    const titleMatch = html.match(/title="([^"]+)"/);
    const price = parsePriceFromHtml(html, cheerio.load(html));
    if (images.length > 0) {
      return { asin, title: titleMatch ? titleMatch[1].slice(0, 200) : "Product " + asin, price: price || "", images, features: [], amazon_link: url, affiliate_link, fromFallback: false };
    }
  } catch (e) {}
  try {
    const r = await fetch("https://r.jina.ai/https://" + SITE + "/dp/" + asin, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    const re2 = new RegExp("https:\\/\\/" + IMG_HOST.replace(/\./g, "\\.") + "\\/images\\/I\\/[^)\\s]+\\.jpg", "g");
    const m = text.match(re2);
    const price = parsePriceFromText(text);
    let title = "Product " + asin;
    const lines = text.split("\n").map(s => s.trim()).filter(s => s.length > 20 && s.length < 200 && !s.includes("http") && !s.toLowerCase().includes("warranty") && !s.toLowerCase().includes("onsitego"));
    if (lines.length) title = lines[0].slice(0, 200);
    if (m) {
      const images = [...new Set(m)].slice(0, 5).map(function(u) { return u.replace(/_SL\d+_/, "_SL1500_"); }).filter(isGoodPhoto).slice(0, 3);
      if (images.length > 0) {
        return { asin, title, price: price || "", images, features: [], amazon_link: url, affiliate_link, fromFallback: false };
      }
    }
    if (price) return { asin, title, price, images: [], features: [], amazon_link: url, affiliate_link, fromFallback: false };
  } catch (e) {}
  try {
    const r = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url));
    const html = await r.text();
    const images = cleanImages(html);
    const price = parsePriceFromHtml(html, cheerio.load(html));
    if (images.length > 0) {
      return { asin, title: "Product " + asin, price: price || "", images, features: [], amazon_link: url, affiliate_link, fromFallback: false };
    }
  } catch (e) {}
  try {
    const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url) + "&meta=false&embed=image.url");
    const j = await r.json();
    const ogImg = j && j.data && j.data.image && j.data.image.url ? j.data.image.url : "";
    if (isGoodPhoto(ogImg)) {
      return { asin, title: "Product " + asin, price: "", images: [ogImg], features: [], amazon_link: url, affiliate_link, fromFallback: false };
    }
  } catch (e) {}
  return { asin, title: "Product " + asin, price: "", images: [], features: [], amazon_link: url, affiliate_link, fromFallback: true };
}

async function tryFetch(asin, uaIndex) {
  const url = "https://" + SITE + "/dp/" + asin;
  const res = await fetch(url, { headers: makeHeaders(uaIndex) });
  if (res.status === 503 || res.status === 429) {
    const e = new Error("blocked");
    e.retryable = true;
    e.status = res.status;
    throw e;
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $("#productTitle").text().trim().replace(/\s+/g, " ");
  if (!title) {
    const lower = html.toLowerCase();
    const isBlock = lower.includes("captcha") || lower.includes("not a robot") || lower.includes("robot check") || lower.includes("automated access");
    const e = new Error(isBlock ? "blocked" : "parse fail");
    e.retryable = true;
    throw e;
  }
  let price = parsePriceFromHtml(html, $);
  const images = cleanImages(html);
  const features = [];
  $("#feature-bullets li span.a-list-item").each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (t.length > 8 && t.length < 250) features.push(t);
  });
  const tag = process.env.AMAZON_TAG || "";
  return { asin, title, price, images, features: features.slice(0, 6), amazon_link: url, affiliate_link: tag ? url + "?tag=" + tag : url, fromFallback: false };
}

async function fetchProduct(asinOrUrl) {
  const asin = /^[A-Z0-9]{10}$/i.test(String(asinOrUrl).trim()) ? String(asinOrUrl).trim().toUpperCase() : extractASIN(asinOrUrl);
  if (!asin) throw new Error("ASIN nahi mila");
  try {
    const p = await tryFetch(asin, 0);
    if (p.images.length > 0) return p;
    return await fallbackProduct(asin);
  } catch (e) {
    console.log("Blocked (" + (e.status || e.message) + "), Ad Widget se Asli Photo la raha hu");
    return await fallbackProduct(asin);
  }
}

module.exports = { extractASIN, fetchProduct };
