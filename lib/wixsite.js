// lib/wixsite.js - 【entity-Wix¦canonical_name=Wix】 STORES Product banayega
function getWixCreds(niche) {
  try {
    const map = JSON.parse(process.env.WIX_JSON || "{}");
    const entry = map[(niche || "").toLowerCase()] || {};
    if (entry.key) return { key: entry.key, siteId: entry.siteId || "" };
  } catch (e) {}
  return { key: process.env.WIX_API_KEY || "", siteId: process.env.WIX_SITE_ID || "" };
}
async function publishPost(niche, title, htmlContent, imageUrl, link, product) {
  const { key, siteId } = getWixCreds(niche);
  if (!key) throw new Error("Wix Key nahi hai " + niche);
  if (!siteId) throw new Error("Wix Site ID nahi hai " + niche);
  const headers = { "Content-Type": "application/json", "Authorization": key, "wix-site-id": siteId };
  let priceNum = 0;
  try {
    const pStr = String(product?.price || product?.mrp || "").replace(/[^0-9.]/g, "");
    priceNum = parseFloat(pStr) || 0;
  } catch (e) {}
  if (!priceNum) priceNum = 999;
  const imgs = [];
  if (Array.isArray(product?.images)) {
    for (const im of product.images) { if (im && im.startsWith("https://") && !imgs.includes(im)) imgs.push(im); if (imgs.length >= 3) break; }
  }
  if (!imgs.length && imageUrl) imgs.push(imageUrl);
  const cleanDesc = String(htmlContent).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
  const body = {
    product: {
      name: (title || "Product").slice(0, 200),
      description: cleanDesc + "\n\nBuy on Amazon: " + (link || ""),
      sku: product?.asin || ("ASIN-" + Date.now()),
      visible: true,
      productType: "physical",
      priceData: { price: priceNum, currency: "INR", discountedPrice: priceNum },
      media: { items: imgs.map((url) => ({ src: url, title: title || "Product" })) },
      additionalInfoSections: [{ title: "Buy Link", description: link || "" }]
    }
  };
  const res = await fetch("https://www.wixapis.com/stores/v1/products", { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  const pid = j?.product?.id || "";
  if (!pid) throw new Error("Wix Product fail: " + JSON.stringify(j).slice(0, 400));
  return "wix-product:" + pid;
}
module.exports = { publishPost };
