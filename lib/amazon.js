// lib/amzn.js - FINAL - Price Fix - Sponsored wala Price nahi, Asli Product wala Price
const S = "am" + "azon";
const UA_LIST = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];
function pickUA() { return UA_LIST[Math.floor(Math.random() * UA_LIST.length)]; }
function cleanImages(arr) {
  const out = [];
  for (const u of (arr || [])) {
    if (!u || typeof u !== "string") continue;
    let c = u.trim();
    if (!c.startsWith("https://")) continue;
    if (c.includes("play-icon") || c.includes("sprite") || c.includes("1x1") || c.includes("transparent") || c.includes("loading") || c.includes("thum.io") || c.includes("picsum") || c.includes("placeholder")) continue;
    if (c.toLowerCase().includes("onsitego") || c.toLowerCase().includes("warranty") || c.toLowerCase().includes("protection")) continue;
    c = c.replace(/_SL\d+_/, "_SL2000_").replace(/_SX\d+_/, "_SX2000_").replace(/_SS\d+_/, "_SL2000_");
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, 5);
}
function extractPrice(html) {
  // FIX - Sirf Asli Price Box se Price lo - Sponsored / Related Product wala Price mat lo
  // 1. corePrice Box - Asli Product ka Price Yahi hota hai
  let m = html.match(/id="corePriceDisplay[\s\S]{0,5000}?a-price-whole[^>]*>([\d,]+)</);
  if (m) return { price: "₹" + m[1], mrp: "" };
  // 2. priceToPay Block
  m = html.match(/priceToPay[\s\S]{0,3000}?a-price-whole[^>]*>([\d,]+)</);
  if (m) return { price: "₹" + m[1], mrp: "" };
  // 3. Deal Price Block
  m = html.match(/dealPrice[\s\S]{0,3000}?a-price-whole[^>]*>([\d,]+)</);
  if (m) return { price: "₹" + m[1], mrp: "" };
  // 4. a-price a-text-price = MRP, uske paas wala hi Deal Price hota hai - MRP bhi nikal lo
  let mrp = "";
  const mrpM = html.match(/a-text-price[\s\S]{0,1000}?a-offscreen[^>]*>₹([\d,]+)</);
  if (mrpM) mrp = "₹" + mrpM[1];
  // 5. Last Rasta - Title ke baad wala Pehla Price - Page ke Top wala Sponsored Price nahi
  const titleIdx = html.indexOf("productTitle");
  const afterTitle = titleIdx > 0 ? html.slice(titleIdx, titleIdx + 80000) : html;
  m = afterTitle.match(/a-price-whole[^>]*>([\d,]+)</);
  if (m) return { price: "₹" + m[1], mrp: mrp };
  return { price: "", mrp: mrp };
}
function extractFromHtml(html) {
  const images = [];
  const titleM = html.match(/<span[^>]*id="productTitle"[^>]*>([\s\S]{0,300}?)<\/span>/);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const colorM = html.match(/"colorImages"\s*:\s*(\{[\s\S]{0,8000}?\})\s*,\s*"colorToAsin"/);
  if (colorM) {
    const urls = [...colorM[1].matchAll(/"hiRes"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
    images.push(...urls);
    const large = [...colorM[1].matchAll(/"large"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
    images.push(...large);
  }
  const landM = html.match(/data-a-dynamic-image="([^"]+)"/);
  if (landM) {
    try {
      const obj = JSON.parse(landM[1].replace(/&quot;/g, '"'));
      images.push(...Object.keys(obj));
    } catch (e) {}
  }
  const pr = extractPrice(html);
  const price = pr.price;
  const mrp = pr.mrp;
  const feats = [...html.matchAll(/<span class="a-list-item"[^>]*>([\s\S]{0,200}?)<\/span>/g)].map(m => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).filter(f => f.length > 20 && f.length < 150).slice(0, 5);
  return { title, images: cleanImages(images), price, mrp, features: feats };
}
async function getProduct(asin, affiliateLink) {
  const url = "https://www." + S + ".in/dp/" + asin;
  let title = "", images = [], price = "", mrp = "", features = [];
  try {
    const r = await fetch(url, { headers: { "User-Agent": pickUA(), "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-IN,en;q=0.9", "Referer": "https://www.google.co.in/" } });
    const html = await r.text();
    if (html && html.length > 20000) {
      const ex = extractFromHtml(html);
      title = ex.title; images = ex.images; price = ex.price; mrp = ex.mrp; features = ex.features;
    }
  } catch (e) {}
  if (images.length === 0 || !price) {
    try {
      const jr = await fetch("https://r.jina.ai/" + url, { headers: { "User-Agent": pickUA(), "X-Return-Format": "html" } });
      const html = await jr.text();
      if (html && html.length > 5000) {
        const ex = extractFromHtml(html);
        if (!title) title = ex.title;
        if (images.length === 0) images = ex.images;
        if (!price) price = ex.price;
        if (!mrp) mrp = ex.mrp;
        if (features.length === 0) features = ex.features;
      }
    } catch (e) {}
  }
  if (images.length === 0) {
    try {
      const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url) + "&meta=false&embed=image.url&embed=title&embed=price");
      const j = await r.json();
      if (j && j.data && j.data.image && j.data.image.url) images = [j.data.image.url];
      if (!title && j.data.title) title = j.data.title;
    } catch (e) {}
  }
  if (images.length === 0) {
    try {
      const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(affiliateLink || url) + "&screenshot=true&meta=false&embed=screenshot.url");
      const j = await r.json();
      if (j && j.data && j.data.screenshot && j.data.screenshot.url) images = [j.data.screenshot.url];
    } catch (e) {}
  }
  if (!title) title = "Product " + asin;
  if (!price) price = "";
  return { asin, title, images: cleanImages(images), price, mrp, features, amazon_link: url, affiliate_link: affiliateLink || url };
}
module.exports = { getProduct, fetchProduct: getProduct, getProductDetails: getProduct, fetchProductDetails: getProduct };
