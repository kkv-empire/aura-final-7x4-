// lib/scheduler.js — Vercel Cron har 30 min: 1 product = render + 4 platforms
const { popNext, setStatus } = require("./queue");
const { distribute } = require("./distributor");
const { notifyAdmin } = require("./telegram");

async function runScheduled() {
  const product = await popNext();
  if (!product) {
    return { done: false, reason: "queue empty" };
  }
  await setStatus(product.id, "processing");
  try {
    const { videoUrl, results } = await distribute(product);
    await setStatus(product.id, "done", { videoUrl, results: JSON.stringify(results) });
    const ok = Object.entries(results).filter(([, r]) => r.ok).map(([k]) => k).join(", ");
    const fail = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k).join(", ");
    await notifyAdmin(
      `✅ <b>${product.niche}</b> post ho gaya!\n📦 ${product.title.slice(0, 80)}\n` +
      `✔️ ${ok || "—"}` + (fail ? `\n❌ ${fail}` : "")
    );
    return { done: true, id: product.id, results };
  } catch (e) {
    await setStatus(product.id, "failed", { error: String(e.message || e).slice(0, 300) });
    await notifyAdmin(`❌ <b>${product.niche}</b> fail: ${String(e.message || e).slice(0, 150)}`);
    return { done: false, error: String(e.message || e) };
  }
}

module.exports = { runScheduled };
