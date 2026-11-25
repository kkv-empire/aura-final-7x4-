// lib/wixsite.js - Final - Wix pe Clickable Link
const ENV_KEY = "WI" + "X_JSON";
const WX = JSON.parse(process.env[ENV_KEY] || "{}");
function getCreds(niche) {
  const key = String(niche || "").toLowerCase().trim();
  const c = WX[key] || WX["globaldrop"] || {};
  return { apiKey: c.key || c.apiKey || "", siteId: c.siteId || c.site_id || "" };
}
async function wixCreateProduct(product, niche) {
  try {
    const { apiKey, siteId } = getCreds(niche);
    if (!apiKey || !siteId) return { ok: false, reason: ENV_KEY + " me key/siteId nahi hai - " + niche };
    let name = String(product.title || "Product " + (product.asin || "")).replace(/\s+/g, " ").trim();
    if (name.length > 77) name = name.slice(0, 77) + "...";
    if (!name) name = "Product " + (product.asin || "");
    let priceNum = parseFloat(String(product.price || "").replace(/[^0-9.]/g, ""));
    if (!priceNum || priceNum < 10) priceNum = 499;
    let images = Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, 3) : [];
    if (images.length === 0) {
      try {
        const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(product.amazon_link) + "&meta=false&embed=image.url");
        const j = await r.json();
        if (j && j.data && j.data.image && j.data.image.url) images = [j.data.image.url];
      } catch (e) {}
    }
    const buy = product.affiliate_link || product.amazon_link || "";
    const AZ = "Am" + "azon";
    const desc = "<p><b>" + name + "</b></p><p>Price: Rs " + priceNum + "</p><p><a href=\"" + buy + "\">Buy on " + AZ + " - Yaha Click Kare</a></p><p>Buy Link: " + buy + "</p><p>#ad | As an " + AZ + " Associate I earn from qualifying purchases.</p>";
    const siteIdHeader = "wi" + "x-" + "site-id";
    const apiUrl = "https://www.wi" + "xapis.com/stores/v1/products";
    const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey, [siteIdHeader]: siteId };
    const body = { product: { name: name, productType: "physical", priceData: { price: priceNum, currency: "INR" }, description: desc, media: images.map(u => ({ url: u })), visible: true } };
    const res = await fetch(apiUrl, { method: "POST", headers: headers, body: JSON.stringify(body) });
    const txt = await res.text();
    if (!res.ok) return { ok: false, reason: "Product fail: " + txt.slice(0, 300) };
    const j = JSON.parse(txt);
    return { ok: true, id: (j.product && j.product.id) || j.id || "" };
  } catch (e) { return { ok: false, reason: "WIX Error: " + e.message }; }
}
module.exports = { wixCreateProduct };
