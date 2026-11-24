// lib/wixsite.js - Kabhi FAIL nahi karega - Naam kaat ke, Photo fallback se Post karega
const 【entity-WIX¦canonical_name=WIX】 = JSON.parse(process.env.WIX_JSON || "{}");

function getCreds(niche) {
  const key = String(niche || "").toLowerCase().trim();
  const c = 【entity-WIX¦canonical_name=WIX】[key] || 【entity-WIX¦canonical_name=WIX】["globaldrop"] || {};
  return { apiKey: c.key || c.apiKey || "", siteId: c.siteId || c.site_id || "" };
}

async function wixCreateProduct(product, niche) {
  try {
    const { apiKey, siteId } = getCreds(niche);
    if (!apiKey || !siteId) return { ok: false, reason: "WIX_JSON me key/siteId nahi hai - " + niche };

    // 1. Naam - 80 se zyada kabhi nahi - 188 wala bhi chalega
    let name = String(product.title || "Product " + product.asin || "Product").replace(/\s+/g, " ").trim();
    if (name.length > 77) name = name.slice(0, 77) + "...";
    if (!name) name = "Product " + (product.asin || "");

    // 2. Price - Khali ho to 999 mat do, 0 bhi mat do - Real Price hi lo, na mile to 499
    let priceNum = parseFloat(String(product.price || "").replace(/[^0-9.]/g, ""));
    if (!priceNum || priceNum < 10) priceNum = 499;

    // 3. Images - Khali ho to Microlink OG se lo, fir bhi khali ho to bina Image ke Post karo - FAIL mat karo
    let images = Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, 3) : [];
    if (images.length === 0) {
      try {
        const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(product.amazon_link) + "&meta=false&embed=image.url");
        const j = await r.json();
        if (j && j.data && j.data.image && j.data.image.url) images = [j.data.image.url];
      } catch (e) {}
    }

    // 4. Description - Link hamesha Blue + Clickable - HTML me
    const buy = product.affiliate_link || product.amazon_link || "";
    const desc = "<p><b>" + name + "</b></p><p>Price: Rs " + priceNum + "</p><p><a href=\"" + buy + "\">👉 Buy on 【entity-Amazon¦canonical_name=Amazon】 - Yaha Click Kare</a></p><p>#ad | As an 【entity-Amazon¦canonical_name=Amazon】 Associate I earn from qualifying purchases.</p>";

    const body = {
      product: {
        name: name,
        productType: "physical",
        priceData: { price: priceNum, currency: "INR" },
        description: desc,
        media: images.map(u => ({ url: u })),
        visible: true
      }
    };

    const siteIdHeader = "【entity-wix¦canonical_name=WIX】-" + "site-id";
    const res = await fetch("https://www.wixapis.com/stores/v1/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        [siteIdHeader]: siteId
      },
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    if (!res.ok) {
      // Agar Media se Fail hua to bina Image ke fir se Try karo - Rukna nahi hai
      if (images.length > 0) {
        body.product.media = [];
        const res2 = await fetch("https://www.wixapis.com/stores/v1/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey, [siteIdHeader]: siteId },
          body: JSON.stringify(body)
        });
        const txt2 = await res2.text();
        if (res2.ok) return { ok: true, id: JSON.parse(txt2).product.id, note: "Bina Image ke Post hua" };
        return { ok: false, reason: "Product fail: " + txt2.slice(0, 300) };
      }
      return { ok: false, reason: "Product fail: " + txt.slice(0, 300) };
    }
    return { ok: true, id: JSON.parse(txt).product.id };
  } catch (e) {
    return { ok: false, reason: "WIX Error: " + e.message };
  }
}

module.exports = { wixCreateProduct };
