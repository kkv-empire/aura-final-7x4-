// lib/【entity-amazon¦canonical_name=Amazon】.js — Link bhejte hi sab kaam, Photo maangna band
// 【entity-Amazon¦canonical_name=Amazon】 Block ho to bhi ASIN se Affiliate + Image bana ke aage badho

const cheerio = require("cheerio");

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
  const m = String(text).match(/amazon\.in\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Block ho to bhi kaam chalao - ASIN se hi Product banao
function fallbackProduct(asin) {
  const tag = process.env.AMAZON_TAG || "";
  const url = `https://www.【entity-amazon¦canonical_name=Amazon】.in/dp/${asin}`;
  // Amazon ki Image ASIN se hi mil jaati hai, Page kholne ki zarurat nahi
  const images = [
    `https://m.media-amazon.com/images/P/${asin}.01._SL500_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL500_.jpg`,
  ];
  return {
    asin,
    title: `Product ${asin}`,
    price: "",
    images,
    features: [],
    amazon_link: url,
    affiliate_link: tag ? `${url}?tag=${tag}` : url,
    fromFallback: true,
  };
}

async function tryFetch(asin, uaIndex) {
  const url = `https://www.amazon.in/dp/${asin}`;
  const res = await fetch(url, { headers: makeHeaders(uaIndex) });
  if (res.status === 503 || res.status === 429) {
    const e = new Error("blocked");
    e.retryable = true;
    e.status = res.status;
    throw e;
  }
  if (!res.ok) throw new Error("Amazon HTTP " + res.status);
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
  const tag = process.env.AMAZON_TAG || "";
  return { asin, title, price, images, features: features.slice(0, 6), amazon_link: url, affiliate_link: tag ? `${url}?tag=${tag}` : url, fromFallback: false };
}

async function fetchProduct(asinOrUrl) {
  const asin = /^[A-Z0-9]{10}$/i.test(asinOrUrl) ? asinOrUrl.toUpperCase() : extractASIN(asinOrUrl);
  if (!asin) throw new Error("ASIN nahi mila");

  // Sirf 1 baar koshish karo, 3 baar nahi - Time bachao
  try {
    return await tryFetch(asin, 0);
  } catch (e) {
    console.log(`Amazon blocked (${e.status || e.message}), Fallback se kaam chala raha hu - Photo maangna band`);
    // Block ho to bhi Error mat do, Fallback Product de do - Link se hi kaam ho jayega
    return fallbackProduct(asin);
  }
}

module.exports = { extractASIN, fetchProduct };
