// lib/youtube.js - YT Upload - Refresh Token se Access Token -> Video Upload
async function getAccessToken(refresh, clientId, clientSecret) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("YT Access Token fail: " + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

async function uploadVideoToYT({ niche, title, description, videoBuffer }) {
  const nicheUp = (niche || "").toUpperCase();
  const refresh = process.env["YT_" + nicheUp] || "";
  const cid = process.env.YT_CLIENT_ID || "";
  const csec = process.env.YT_CLIENT_SECRET || "";
  if (!refresh || !cid || !csec) throw new Error("YT Creds missing " + niche);
  const access = await getAccessToken(refresh, cid, csec);

  // 1. Upload Session banao
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + access,
      "Content-Type": "application/json",
      "X-Upload-Content-Length": String(videoBuffer.length),
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description: description.slice(0, 5000), categoryId: "27" },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YT Init fail: " + (await init.text()).slice(0, 300));

  // 2. Video Upload karo
  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(videoBuffer.length) },
    body: videoBuffer,
  });
  const j = await up.json();
  if (!j.id) throw new Error("YT Upload fail: " + JSON.stringify(j).slice(0, 300));
  return j.id;
}

module.exports = { uploadVideoToYT, getAccessToken };
