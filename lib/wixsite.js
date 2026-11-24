// lib/wixsite.js - FINAL - Image Upload + Product
function getCreds(niche) {
  try {
    const map = JSON.parse(process.env.WIX_JSON || "{}");
    const entry = map[(niche || "").toLowerCase()] || {};
    if (entry.key) return { key: entry.key, siteId: entry.siteId || "" };
  } catch (e) {}
  return { key: process.env.WIX_API_KEY || "", siteId: process.env.WIX_SITE_ID || "" };
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
  let priceNum = 0;
  try {
    const raw = product?.price || product?.mrp || product?.priceValue || "";
    priceNum = parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
  } catch (e) {}
  if (!priceNum) priceNum = 999;
  const imgs = [];
  if (Array.isArray(product?.images)) { for (const im of product.images) { if (im && im.startsWith("https://") && !imgs.includes(im)) imgs.push(im); if (imgs.length >= 3) break; } }
  if (!imgs.length && imageUrl) imgs.push(imageUrl);
  const mediaItems = [];
  for (let i = 0; i < imgs.length; i++) {
    const fid = await uploadMedia(headers, imgs[i], "product-" + (product?.asin || "x") + "-" + i);
    if (fid) mediaItems.push({ mediaId: fid, title: title || "Product" });
  }
  if (!mediaItems.length && imgs.length) mediaItems.push({ src: imgs[0], title: title || "Product" });
  const cleanDesc = String(htmlContent).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
  const body = {
    product: {
      name: (title || "Product").slice(0, 200),
      description: cleanDesc + "\n\nBuy on Amazon: " + (link || ""),
      sku: product?.asin || ("ASIN-" + Date.now()),
      visible: true,
      productType: "physical",
      priceData: { price: priceNum, currency: "INR", discountedPrice: priceNum },
      media: { items: mediaItems },
      additionalInfoSections: [{ title: "Buy Link", description: link || "" }]
    }
  };
  const res = await fetch("https://www.wixapis.com/stores/v1/products", { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  const pid = j?.product?.id || "";
  if (!pid) throw new Error("Product fail: " + JSON.stringify(j).slice(0, 400));
  return "wix-product:" + pid;
}
module.exports = { publishPost };
