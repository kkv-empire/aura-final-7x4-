// lib/wixsite.js — 【entity-Wix¦canonical_name=Wix】 Blog API: draft post → publish
// WIX_JSON me 7 niche ki Key + Site ID hogi
const 【entity-WIX¦canonical_name=Wix】 = "https://www.wixapis.com/blog/v3";

function getWixCreds(niche) {
  // Naya - WIX_JSON se
  try {
    const map = JSON.parse(process.env.WIX_JSON || "{}");
    const entry = map[(niche || "").toLowerCase()] || {};
    if (entry.key) return { key: entry.key, siteId: entry.siteId || "" };
  } catch (e) {}
  // Purana - Single Key wala, Backup ke liye
  return { key: process.env.WIX_API_KEY || "", siteId: process.env.WIX_SITE_ID || "" };
}

async function publishPost(niche, title, htmlContent, imageUrl, link) {
  const { key, siteId } = getWixCreds(niche);
  if (!key) throw new Error("Wix Key nahi hai " + niche + " - WIX_JSON me daalo");
  if (!siteId) throw new Error("Wix Site ID nahi hai " + niche + " - WIX_JSON me daalo");

  const headers = {
    "Content-Type": "application/json",
    "Authorization": key,
    "wix-site-id": siteId,
  };
  // 1. Draft banao
  const caption = stripHtml(htmlContent).slice(0, 4000) + (link ? "\n\nBuy here: " + link : "");
  const dRes = await fetch(`${WIX}/draft-posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      draftPost: {
        title: (title || "Product").slice(0, 200),
        richContent: {
          nodes: [
            { type: "PARAGRAPH", nodes: [{ type: "TEXT", textData: { text: caption } }] },
          ],
        },
        media: imageUrl ? { wixMedia: { image: imageUrl } } : undefined,
      },
    }),
  });
  const d = await dRes.json().catch(() => ({}));
  const draftId = d?.draftPost?.id;
  if (!draftId) throw new Error("Wix draft fail: " + JSON.stringify(d).slice(0, 300));

  // 2. Publish karo
  const pRes = await fetch(`${WIX}/draft-posts/${draftId}/publish`, { method: "POST", headers });
  const p = await pRes.json().catch(() => ({}));
  return p?.post?.url || `wix-post:${draftId}`;
}

function stripHtml(h) {
  return String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = { publishPost };
