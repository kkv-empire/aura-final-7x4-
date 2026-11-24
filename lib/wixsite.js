// lib/wixsite.js - FINAL - Microlink Image + Jina Price + Clickable Link
function getCreds(niche) {
  try {
    const map = JSON.parse(process.env.WIX_JSON || "{}");
    const entry = map[(niche || "").toLowerCase()] || {};
    if (entry.key) return { key: entry.key, siteId: entry.siteId || "" };
  } catch (e) {}
  return { key: process.env.【entity-WIX_API_KEY¦canonical_name=Wix】 || "", siteId: process.env.【entity-WIX_SITE_ID¦canonical_name=Wix】 || "" };
}
async function getOgImage(asin) {
  try {
    const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent("https://www.amazon.in/dp/" + asin) + "&meta=false&embed=image.url");
    const j = await r.json();
    const u = j && j.data && j.data.image && j.data.image.url ? j.data.image.url : "";
    if (u && u.startsWith("https://") && !u.includes("thum.io")) return u;
  } catch (e) {}
  return "";
}
async function getJinaPrice(asin) {
  try {
    const r = await fetch("https://r.jina.ai/https://www.amazon.in/dp/" + asin, { headers: { "User-Agent": "Mozilla/5.0" } });
    const t = await r.text();
    const m = t.match(/₹\s*([\d,]{3,}\.?\d*)/);
    if (m) return parseFloat(m[1].replace(/,/g, "")) || 0;
  } catch (e) {}
  return 0;
}
async function uploadMedia(headers, imageUrl, fileName) {
  try {
    const safeName = String(fileName || "product").replace(/[^\x00-\x7F]/g, "").slice(0, 50) || "product";
    const r = await fetch("https://www.wixapis.com/site-media/v1/files/import", {
      method: "POST", headers,
      body: JSON.stringify({ url: imageUrl, displayName: safeName, mediaType: "IMAGE" })
    });
    const j = await r.json().catch(() => ({}));
    return j?.file?.id || j?.file?.fileId || "";
  } catch (e) { return ""; }
}
async function publishPost(niche, title, htmlContent, imageUrl, link, product) {
  const { key, siteId } = getCreds(niche);
  if (!key) throw new Error("Key nahi hai " + niche);
  if (!siteId) throw new Error("Site ID nahi hai " + niche);
  const H = "wi" + "x" + "-site-id";
  const headers = {};
  headers["Content-Type"] = "application/json";
  headers["Authorization"] = key;
  headers[H] = siteId;
  const asin = product?.asin || "";
  // 2. Price - Pehle product.price, nahi mila to Jina se
  let priceNum = 0;
  try {
    const raw = product?.price || product?.mrp || product?.priceValue || "";
    priceNum = parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
  } catch (e) {}
  if (!priceNum && asin) priceNum = await getJinaPrice(asin);
  if (!priceNum) priceNum = 999;
  // 1. Image - Pehle product.images, nahi mila to Microlink OG Image (Telegram wali)
  const imgs = [];
  if (Array.isArray(product?.images)) {
    for (const im of product.images) {
      if (!im || !im.startsWith("https://")) continue;
      if (im.includes("thum.io") || im.includes("screenshot")) continue;
      if (!imgs.includes(im)) imgs.push(im);
      if (imgs.length >= 3) break;
    }
  }
  if (!imgs.length && imageUrl && !imageUrl.includes("thum.io")) imgs.push(imageUrl);
  if (!imgs.length && asin) {
    const og = await getOgImage(asin);
    if (og) imgs.push(og);
  }
  const mediaItems = [];
  for (let i = 0; i < imgs.length; i++) {
    const fid = await uploadMedia(headers, imgs[i], "product-" + (asin || "x") + "-" + i);
    if (fid) mediaItems.push({ mediaId: fid, title: title || "Product" });
  }
  if (!mediaItems.length && imgs.length) mediaItems.push({ src: imgs[0], title: title || "Product" });
  const cleanDesc = String(htmlContent).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
  // 3. Clickable Link - Description me, Block me nahi
  const descWithLink = cleanDesc + "\n\nBuy on Amazon: " + (link || "") + "\n" + (link || "");
  const body = {
    product: {
      name: (title || "Product").slice(0, 200),
      description: descWithLink,
      sku: asin || ("ASIN-" + Date.now()),
      visible: true,
      productType: "physical",
      priceData: { price: priceNum, currency: "INR", discountedPrice: priceNum },
      media: { items: mediaItems }
    }
  };
  const res = await fetch("https://www.wixapis.com/stores/v1/products", { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  const pid = j?.product?.id || "";
  if (!pid) throw new Error("Product fail: " + JSON.stringify(j).slice(0, 400));
  return "wix-product:" + pid;
}
module.exports = { publishPost };
