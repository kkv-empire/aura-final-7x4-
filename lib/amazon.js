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
  // 1. MAIN FIX - Sirf colorImages -> initial se lo - Ye hi Asli Product ki Gallery hai, Warranty yaha nahi hoti
  const colorMatch = html.match(/"colorImages":\s*\{\s*"initial":\s*(\[[\s\S]{0,30000}?)\]/);
  if (colorMatch) {
    const hires = colorMatch[1].match(/"hiRes":"(https:[^"]+)"/g) || [];
    for (const h of hires) {
      const u = h.slice(9, -1).replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_");
      if (isGoodPhoto(u) && !found.includes(u)) found.push(u);
      if (found.length >= 3) break;
    }
    if (found.length > 0) return found.slice(0, 3);
  }
  // 2. FALLBACK - landingImage - Ye bhi hamesha Main Product ki hoti hai
  const land = html.match(/id="landingImage"[^>]*data-old-hires="([^"]+)"/);
  if (land && isGoodPhoto(land[1])) found.push(land[1].replace(/_SL\d+_/, "_SL1500_"));
  if (found.length > 0) return found.slice(0, 3);
  // 3. LAST FALLBACK - Purana tarika
  const hiRes = html.match(/"hiRes":"(https:[^"]+)"/g) || [];
  for (const h of hiRes) {
    const u = h.slice(9, -1).replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_");
    if (isBadImage(u)) continue;
    if (isGoodPhoto(u) && !found.includes(u)) found.push(u);
    if (found.length >= 3) break;
  }
  const re = new RegExp("https:\\/\\/" + IMG_HOST.replace(/\./g, "\\.") + "\\/images\\/I\\/[A-Za-z0-9._\\-+ %]+\\.jpg", "g");
  const dyn = html.match(re) || [];
  for (const u of dyn) {
    if (isBadImage(u)) continue;
    const clean = u.replace(/_SL\d+_/, "_SL1500_").replace(/_SX\d+_/, "_SX1500_").replace(/_SS\d+_/, "_SL1500_");
    if (isGoodPhoto(clean) && !found.includes(clean)) found.push(clean);
    if (found.length >= 3) break;
  }
  return found.slice(0, 3);
}

function parsePriceFromHtml(html, $) {
  try {
    const core = $("#corePriceDisplay_desktop_feature_div .a-offscreen").first().text().trim();
    if (core && core.includes("₹")) {
      const v = parseFloat(core.replace(/[^0-9.]/g, ""));
      if (
