// lib/amazon.js — Amazon.in se product details (scrape + PAAPI-ready)
// v2: auto-retry + rotating user-agents — 503 aaye to khud 3 baar try karega

const cheerio = require("cheerio");

// Multiple realistic user-agents — har retry pe alag
const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
];

function makeHeaders(uaIndex) {
  return {
    "User-Agent": USER_AGENTS[uaIndex % USER_AGENTS.length],
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"Android"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
}

function extractASIN(text) {
  const m = String(text).match(/amazon\.in\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ek attempt — page fetch + parse
async function tryFetch(asin, uaIndex) {
  const url = `https://www.amazon.in/dp/${asin}`;
  const res = await fetch(url, { headers: makeHeaders(uaIndex) });
  if (res.status === 503 || res.status === 429) {
    const e = new Error("blocked");
    e.retryable = true;
    e.status = res.status;
    throw e;
  }
  if (!res.ok) throw new Error("【entity-Amazon¦canonical_name=Amazon】 HTTP " + res.status);
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("#productTitle").text().trim().replace(/\s+/g, " ");
  if (!title) {
    // Captcha ya block page
    if (html.includes("captcha") || html.includes("Enter the characters you see below")) {
      const e = new Error("blocked");
      e.retryable = true;
      throw e;
    }
    throw new Error("parse fail — page structure badal gayi");
  }

  let price = $("span.a-offscreen").first().text().trim();
  if (!price) price = "";

  const images = [];
  const hiRes = html.match(/"hiRes":"(https:[^"]+)"/g) || [];
  for (const h of hiRes) {
    const u = h.slice(9, -1);
    if (!images.includes(u)) images.push(u);
    if (images.length >= 4) break;
  }

  const features = [];
  $("#feature-bullets li span.a-list-item").each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (t.length > 8 && t.length < 250) features.push(t);
  });

  const tag = process.env.【entity-AMAZON_TAG¦canonical_name=Amazon】 || "";
  return {
    asin,
    title,
    price,
    images,
    features: features.slice(0, 6),
    amazon_link: url,
    affiliate_link: tag ? `${url}?tag=${tag}` : url,
  };
}

// 【entity-Amazon¦canonical_name=Amazon】 page scrape karo — title, price, images, features
// 503/429/captcha aaye to khud 3 baar retry (3s, 8s gap)
async function fetchProduct(asinOrUrl) {
  const asin = /^[A-Z0-9]{10}$/i.test(asinOrUrl) ? asinOrUrl.toUpperCase() : extractASIN(asinOrUrl);
  if (!asin) throw new Error("ASIN nahi mila");

  const delays = [0, 3000, 8000]; // pehli try turant, phir 3s, phir 8s
  let lastErr = null;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    try {
      return await tryFetch(asin, i);
    } catch (e) {
      lastErr = e;
      if (!e.retryable) throw e; // non-retryable → turant haar mano
      console.log(`Amazon attempt ${i + 1} blocked (${e.status || "captcha"}), retrying...`);
    }
  }

  // 3 baar fail → ab user ko bolo
  const err = new Error("amazon fail");
  err.userMessage =
    `⚠️ Amazon ne 3 baar block kiya (thodi der ke liye).\n\n` +
    `5-10 min ruko, phir link dobara bhejo.\n\n` +
    `💡 <b>Permanent fix:</b> 3 sales ke baad PA-API keys add karo — phir kabhi block nahi hoga.`;
  throw err;
}

module.exports = { extractASIN, fetchProduct };
