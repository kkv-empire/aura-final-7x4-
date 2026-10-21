// lib/youtube.js — YouTube Data API v3: Shorts upload (per-niche OAuth)
// YT_REFRESH_JSON env = { "Aivendora": {"client_id":"..","client_secret":"..","refresh_token":".."}, ... }
const { google } = require("googleapis");
const fs = require("fs");

function getRefreshMap() {
  try { return JSON.parse(process.env.YT_REFRESH_JSON || "{}"); }
  catch { return {}; }
}

async function uploadShort(niche, videoPath, title, description) {
  const creds = getRefreshMap()[niche];
  if (!creds) throw new Error(`YouTube creds nahi mile: ${niche}`);
  const auth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  auth.setCredentials({ refresh_token: creds.refresh_token });
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description: description.slice(0, 5000),
        tags: ["amazonfinds", "onlineshopping", niche.toLowerCase(), "shorts"],
        categoryId: "27",
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(videoPath) },
  });
  return `https://youtu.be/${res.data.id}`;
}

module.exports = { uploadShort };
