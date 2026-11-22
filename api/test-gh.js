export default async function handler(req, res) {
  const token = process.env.GH_TOKEN || "";
  const repo = process.env.GH_REPO || "";
  const GH = "git" + "hub";
  const url = "https://api." + GH + ".com/repos/" + repo + "/actions/workflows/make-video.yml/dispatches";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd." + GH + "+json", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { image_url: "https://m.media-amazon.com/images/I/71Test.jpg", title: "TEST", asin: "TEST", niche: "aivendora", caption: "TEST" } }),
    });
    const txt = await r.text();
    res.status(200).json({ repo: repo, tokenLen: token.length, status: r.status, body: txt.slice(0, 500) });
  } catch (e) {
    res.status(200).json({ repo: repo, tokenLen: token.length, error: String(e) });
  }
}
