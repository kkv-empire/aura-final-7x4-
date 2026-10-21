// lib/video.js — Product images se 1080x1920 slideshow video (ffmpeg-static)
// Text video pe burn nahi hota (v1) — saara text caption/description me jaata hai.
// Ye platform rules ke liye bhi safe hai (price change ho to video galat nahi padta).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpegPath = require("ffmpeg-static");

const W = 1080, H = 1920, SEC_PER_IMG = 4;

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("img download fail: " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg: " + err.slice(-500)))));
  });
}

// images: [url...] → /tmp/*.mp4 ka path return
async function renderSlideshow(images) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-"));
  const imgs = images.slice(0, 4);
  if (imgs.length === 0) throw new Error("koi image nahi");

  for (let i = 0; i < imgs.length; i++) {
    await downloadImage(imgs[i], path.join(dir, `img${i}.jpg`));
  }

  const out = path.join(dir, "out.mp4");
  const inputs = [];
  const filters = [];
  imgs.forEach((_, i) => {
    inputs.push("-loop", "1", "-t", String(SEC_PER_IMG), "-i", path.join(dir, `img${i}.jpg`));
    filters.push(
      `[${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},` +
      `zoompan=z='min(zoom+0.0012,1.15)':d=${SEC_PER_IMG * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=25[v${i}]`
    );
  });
  const concat = imgs.map((_, i) => `[v${i}]`).join("") + `concat=n=${imgs.length}:v=1:a=0[v]`;
  const args = [
    ...inputs,
    "-filter_complex", filters.join(";") + ";" + concat,
    "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", out,
  ];
  await runFFmpeg(args);
  return out;
}

module.exports = { renderSlideshow };
