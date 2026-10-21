// lib/amazon.js — Amazon.in se product details (scrape + PAAPI-ready)
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
  "Accept": "text/html,application/xhtml+xml",
};

function extractASIN(text) {
  const m = String(text).match(/amazon\.in\/(?:.*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

// Amazon page scrape karo — title, price, images, features
async function fetchProduct(asinOrUrl) {
  const asin = /^[A-Z0-9]{10}$/i.test(asinOrUrl) ? asinOrUrl.toUpperCase() : extractASIN(asinOrUrl);
  if (!asin) throw new Error("ASIN nahi mila");
  const url = `https://www.amazon.in/dp/${asin}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error("Amazon HTTP " + res.status);
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $("#productTitle").text().trim().replace(/\s+/g, " ");
  if (!title) throw new Error("parse fail — Amazon ne block kiya");

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

  const tag = process.env.AMAZON_TAG || "";
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

module.exports = { extractASIN, fetchProduct };
