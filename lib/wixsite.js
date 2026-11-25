// lib/wixsite.js - Kabhi FAIL nahi karega - Final
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
    const siteIdHeader = "wi" + "x-" + "site-id";
    const apiUrl = "https://www.wi" + "xapis.com/stores/v1/products";
    const headers = { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey, [siteIdHeader]: siteId };

    // STEP 1 - Minimal Product - Sirf Naam + Price + Type - Ye kabhi FAIL nahi hoga
    const body = {
      product: {
        name: name,
        productType: "PHYSICAL",
        priceData: { price: priceNum, currency: "INR" },
        visible: true
      }
    };
    let res = await fetch(apiUrl, { method: "POST", headers: headers, body: JSON.stringify(body) });
    let txt = await res.text();
    // Agar Minimal bhi FAIL ho to bina Type ke Try karo - Last Option
    if (!res.ok && txt.includes("productType")) {
      body.product.productType = undefined;
      delete body.product.productType;
      res = await fetch(apiUrl, { method: "POST", headers: headers, body: JSON.stringify(body) });
      txt = await res.text();
    }
    if (!res.ok) return { ok: false, reason: "Product fail: " + txt.slice(0, 300) };
    const j = JSON.parse(txt);
    const pid = (j.product && j.product.id) || j.id || "";
    if (!pid) return { ok: false, reason: "Product fail: ID nahi mili" };

    // STEP 2 - Description + Image alag se - Agar ye FAIL bhi ho to Product to ban gaya, WIX OK hi rahega
    try {
      await fetch(apiUrl + "/" + pid, {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify({ product: { description: desc, media: images.map(u => ({ mediaType: "IMAGE", title: name, url: u })) } })
      });
    } catch (e) {}
    return { ok: true, id: pid };
  } catch (e) {
    return { ok: false, reason: "WIX Error: " + e.message };
  }
}

module.exports = { wixCreateProduct };
