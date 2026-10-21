// lib/instagram.js — Instagram Graph API: Reel upload (2-step)
const GRAPH = "https://graph.facebook.com/v21.0";

async function postReel(igUserId, pageToken, videoUrl, caption) {
  // Step 1: container banao
  const cRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS", video_url: videoUrl, caption,
      access_token: pageToken,
    }),
  });
  const c = await cRes.json();
  if (!c.id) throw new Error("IG container fail: " + JSON.stringify(c).slice(0, 300));
  const containerId = c.id;

  // Step 2: processing ka wait (max ~90s)
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const sRes = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${pageToken}`);
    const s = await sRes.json();
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") throw new Error("IG processing error");
  }

  // Step 3: publish
  const pRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: pageToken }),
  });
  const p = await pRes.json();
  if (!p.id) throw new Error("IG publish fail: " + JSON.stringify(p).slice(0, 300));
  return p.id;
}

module.exports = { postReel };
