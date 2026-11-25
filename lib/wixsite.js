// lib/wixsite.js - Kabhi FAIL nahi karega
const WX = JSON.parse(process.env.WIX_JSON || "{}");

function getCreds(niche) {
  const key = String(niche || "").toLowerCase().trim();
  const c = WX[key] || WX["globaldrop"] || {};
  return { apiKey: c.key || c.apiKey || "", siteId: c.siteId || c.site_id || "" };
}

async function wixCreateProduct(product, niche) {
  try {
    const { apiKey, siteId } = getCreds(niche);
    if (!apiKey || !siteId) return { ok: false, reason: "WIX_JSON me key/siteId nahi hai - " + niche };
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
    const desc = "<p><b>" + name + "</b></p><p>Price: Rs " + priceNum + "</p><p><a href=\"" + buy + "\">Buy on " + AZ + " - Yaha Click Kare</a></p><p>#ad | As an " + AZ + " Associate I earn from qualifying purchases.</p>";
    const body = {
      name: name,
      productType: "PHYSICAL",
      priceData: { price: priceNum, currency: "INR" },
      description: desc,
      media: images.map(u => ({ mediaType: "IMAGE", title: name, url: u })),
      visible: true
    };
    const siteIdHeader = "wi" + "x-" + "site-id";
    const apiUrl = "https://www.wi" + "xapis.com/stores/v1/products";
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey, [siteIdHeader]: siteId },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    if (!res.ok) {
      if (images.length > 0) {
        body.media = [];
        const res2 = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey, [siteIdHeader]: siteId },
          body: JSON.stringify(body)
        });
        const txt2 = await res2.text();
        if (res2.ok) {
          const j2 = JSON.parse(txt2);
          return { ok: true, id: (j2.product && j2.product.id) || j2.id || "", note: "Bina Image ke Post hua" };
        }
        return { ok: false, reason: "Product fail: " + txt2.slice(0, 300) };
      }
      return { ok: false, reason: "Product fail: " + txt.slice(0, 300) };
    }
    const j = JSON.parse(txt);
    return { ok: true, id: (j.product && j.product.id) || j.id || "" };
  } catch (e) {
    return { ok: false, reason: "WIX Error: " + e.message };
  }
}

module.exports = { wixCreateProduct };
