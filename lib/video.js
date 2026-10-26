// lib/video.js — Product images se 1080x1920 slideshow video (ffmpeg-static)
// FIXED v2: data:image/...;base64 ko direct decode karta hai (fetch data URL pe fail hota hai)
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpegPath = require("ffmpeg-static");

const W = 1080, H = 1920, SEC_PER_IMG = 4;

function decodeDataUrl(url) {
  const m = String(url).match(/^data:image\/[^;]+;base64,(.+)$/s);
  if (!m) return null;
  try { return Buffer.from(m[1], "base64"); } catch { return null; }
}

function isValidImage(buf) {
  if (!buf || buf.length < 100) return false;
  return (
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
    (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)
  );
}

async function downloadImage(url, dest, idx) {
  let buf;
  const dataBuf = decodeDataUrl(url);
  if (dataBuf) {
    buf = dataBuf;
  } else {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`img${idx} download HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (!isValidImage(buf)) throw new Error(`img${idx} invalid image (${buf ? buf.length : 0} bytes)`);
  fs.writeFileSync(dest, buf);
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg: " + err.slice(-600)))));
  });
}

async function renderSlideshow(images) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-"));
  const imgs = images.slice(0, 4);
  if (imgs.length === 0) throw new Error("koi image nahi");
  for (let i = 0; i < imgs.length; i++) await downloadImage(imgs[i], path.join(dir, `img${i}.jpg`), i);
  const out = path.join(dir, "out.mp4");
  const inputs = [], filters = [];
  imgs.forEach((_, i) => {
    inputs.push("-loop", "1", "-t", String(SEC_PER_IMG), "-i", path.join(dir, `img${i}.jpg`));
    filters.push(`[${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},zoompan=z='min(zoom+0.0012,1.15)':d=${SEC_PER_IMG * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=25[v${i}]`);
  });
  const concat = imgs.map((_, i) => `[v${i}]`).join("") + `concat=n=${imgs.length}:v=1:a=0[v]`;
  const args = [...inputs, "-filter_complex", filters.join(";") + ";" + concat, "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", out];
  await runFFmpeg(args);
  return out;
}

module.exports = { renderSlideshow };
