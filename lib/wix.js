// lib/wix.js — Wix Blog API: draft post → publish
// WIX_API_KEY env me hona chahiye (Wix dashboard → API Keys)
const WIX = "https://www.wixapis.com/blog/v3";

async function publishPost(niche, title, htmlContent) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.WIX_API_KEY}`,
  };
  // 1. Draft banao
  const dRes = await fetch(`${WIX}/draft-posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      draftPost: {
        title: title.slice(0, 200),
        richContent: {
          nodes: [
            { type: "PARAGRAPH", nodes: [{ type: "TEXT", textData: { text: stripHtml(htmlContent).slice(0, 4000) } }] },
          ],
        },
      },
    }),
  });
  const d = await dRes.json();
  const draftId = d?.draftPost?.id;
  if (!draftId) throw new Error("Wix draft fail: " + JSON.stringify(d).slice(0, 300));

  // 2. Publish karo
  const pRes = await fetch(`${WIX}/draft-posts/${draftId}/publish`, { method: "POST", headers });
  const p = await pRes.json();
  return p?.post?.url || `wix-post:${draftId}`;
}

function stripHtml(h) {
  return String(h).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = { publishPost }
