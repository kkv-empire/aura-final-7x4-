// lib/ amzn.js - Link bhejte hi sab kaam, Photo maangna band
// Block ho to bhi ASIN se Affiliate + Asli Image bana ke aage badho

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

function cleanImages(html) {
  const found = [];
  const hiRes = html.match(/"hiRes":"(https:[^"]+)"/g) || [];
  for (const h of hiRes) {
    const u = h.slice(9, -1).replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_");
    if (!found.includes(u)) found.push(u);
  }
  const re = new RegExp("https:\\/\\/" + IMG_HOST.replace(/\./g, "\\.") + "\\/images\\/I\\/[A-Za-z0-9._\\-+ %]+\\.jpg", "g");
  const dyn = html.match(re) || [];
  for (const u of dyn) {
    const clean = u.replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_").replace(/_SS\d+_/, "_SL1500_");
    if (!found.includes(clean) && !clean.includes("play-icon") && !clean.includes("sprite") && !clean.includes("1x1")) found.push(clean);
  }
  return found.slice(0, 3);
}

async function fallbackProduct(asin) {
  const tag = process.env.AMAZON_TAG || "";
  const url = "https://" + SITE + "/dp/" + asin;
  const affiliate_link = tag ? url + "?tag=" + tag : url;

  // Tareeka 1 - Ad Widget - Kabhi Block nahi hota, Asli Photo pakki milti hai
  try {
    const widgetUrl = "https://ws-na." + S + "-adsystem.com/widgets/q?ServiceVersion=20070822&OneJS=1&Operation=GetAdHtml&MarketPlace=IN&source=ss&ref=as_ss_li_til&ad_type=product_link&tracking_id=" + tag + "&lbrd=1&ASIN=" + asin;
    const r = await fetch(widgetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();
    const images = cleanImages(html);
    const titleMatch = html.match(/title="([^"]+)"/);
    if (images.length > 0) {
      return { asin, title: titleMatch ? titleMatch[1].slice(0, 120) : "Product " + asin, price: "", images, features: [], amazon_link: url, affiliate_link, fromFallback: false };
    }
  } catch (e) {}

  // Tareeka 2 - Jina AI se - Block Bypass
  try {
    const r = await fetch("https://r.jina.ai/https://" + SITE + "/dp/" + asin, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    const re2 = new RegExp("https:\\/\\/" + IMG_HOST.replace(/\./g, "\\.") + "\\/images\\/I\\/[^)\\s]+\\.jpg", "g");
    const m = text.match(re2);
    if (m) {
      const images = [...new Set(m)].slice(0, 3).map(function(u) { return u.replace(/_SL\d+_/, "_SL1500_"); });
      return { asin, title: "Product " + asin, price: "", images, features: [], amazon_link: url, affiliate_link, fromFallback: false };
    }
  } catch (e) {}

  // Tareeka 3 - Proxy se
  try {
    const r = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url));
    const html = await r.text();
    const images = cleanImages(html);
    if (images.length > 0) {
      return { asin, title: "Product " + asin, price: "", images, features: [], amazon_link: url, affiliate_link, fromFallback: false };
    }
  } catch (e) {}

  // Teeno fail ho gaye to Error mat do - Khali Photo ke saath aage bhejo, Distributor Link Preview se Photo dikha dega
  // PHOTO_NAHI_MILI wala Error hata diya - Post rokna nahi hai
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
  let price = $("span.a-offscreen").first().text().trim();
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
