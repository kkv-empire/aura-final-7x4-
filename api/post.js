// /api/post.js — self-contained webhook: video_url -> 7 IG + 7 FB pages
// Kisi aur file ki zaroorat nahi. Env vars: IG_FB_JSON, POST_TO_IG, POST_TO_FB
export const maxDuration = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gpost(url) {
  const r = await fetch(url, { method: 'POST' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || JSON.stringify(j).slice(0, 200));
  return j;
}

async function gget(url) {
  const r = await fetch(url);
  return r.json().catch(() => ({}));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'webhook alive - POST me video_url bhejo' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const body = req.body || {};
  const video_url = body.video_url;
  const caption = body.caption || '';
  if (!video_url) return res.status(400).json({ error: 'video_url missing hai' });

  let accounts = [];
  try {
    accounts = JSON.parse(process.env.IG_FB_JSON || '[]');
  } catch (e) {
    return res.status(500).json({ error: 'IG_FB_JSON sahi JSON nahi hai' });
  }
  if (!accounts.length) return res.status(500).json({ error: 'IG_FB_JSON khaali hai' });

  const postToIG = (process.env.POST_TO_IG || 'true') === 'true';
  const postToFB = (process.env.POST_TO_FB || 'true') === 'true';

  const results = { ig_ok: [], ig_fail: [], fb_ok: [], fb_fail: [] };

  // ---- Instagram: saare containers ek saath banao ----
  let jobs = [];
  if (postToIG) {
    jobs = await Promise.all(accounts.map(async (a) => {
      if (!a.ig_id) return { a, error: 'ig_id missing' };
      try {
        const c = await gpost(
          'https://graph.facebook.com/v21.0/' + a.ig_id + '/media?media_type=REELS' +
          '&video_url=' + encodeURIComponent(video_url) +
          '&caption=' + encodeURIComponent(caption) +
          '&access_token=' + a.page_token
        );
        return { a, container: c.id };
      } catch (e) { return { a, error: e.message }; }
    }));
  }

  // ---- Facebook Pages: video post (IG processing ke parallel me) ----
  const fbPromise = (async () => {
    if (!postToFB) return;
    await Promise.all(accounts.map(async (a) => {
      if (!a.page_id) { results.fb_fail.push({ page_id: 'missing', err: 'page_id missing' }); return; }
      try {
        await gpost(
          'https://graph.facebook.com/v21.0/' + a.page_id + '/videos' +
          '?file_url=' + encodeURIComponent(video_url) +
          '&description=' + encodeURIComponent(caption) +
          '&access_token=' + a.page_token
        );
        results.fb_ok.push(a.page_id);
      } catch (e) { results.fb_fail.push({ page_id: a.page_id, err: e.message }); }
    }));
  })();

  // ---- IG containers ke FINISHED hone ka wait (max ~40s), fir publish ----
  if (postToIG) {
    jobs.filter((j) => j.error).forEach((j) =>
      results.ig_fail.push({ ig_id: j.a.ig_id || 'missing', err: j.error }));
    let remaining = jobs.filter((j) => j.container);
    const ready = [];
    const deadline = Date.now() + 40000;
    while (remaining.length && Date.now() < deadline) {
      await sleep(5000);
      const still = [];
      for (const j of remaining) {
        const s = await gget('https://graph.facebook.com/v21.0/' + j.container +
          '?fields=status_code&access_token=' + j.a.page_token);
        if (s.status_code === 'FINISHED') ready.push(j);
        else if (s.status_code === 'ERROR') results.ig_fail.push({ ig_id: j.a.ig_id, err: 'container ERROR' });
        else still.push(j);
      }
      remaining = still;
    }
    remaining.forEach((j) => results.ig_fail.push({ ig_id: j.a.ig_id, err: 'timeout: video process nahi hua' }));

    await Promise.all(ready.map(async (j) => {
      try {
        await gpost('https://graph.facebook.com/v21.0/' + j.a.ig_id +
          '/media_publish?creation_id=' + j.container + '&access_token=' + j.a.page_token);
        results.ig_ok.push(j.a.ig_id);
      } catch (e) { results.ig_fail.push({ ig_id: j.a.ig_id, err: e.message }); }
    }));
  }

  await fbPromise;
  return res.status(200).json(results);
}
