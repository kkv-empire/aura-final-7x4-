// lib/queue.js — Queue khatam, turant post karo - 2-3 min me
// Redis / Cron ki zarurat nahi hai. pushJob karte hi turant distribute hoga.

async function pushJob(product) {
  product.id = product.id || `p_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  console.log(`[QUEUE] No queue, instant post: ${product.id} ${product.title}`);
  try {
    // Turant post karo, queue me mat rakho
    const { distribute } = require("./distributor");
    const { notifyAdmin } = require("./telegram");
    const { videoUrl, results } = await distribute(product);

    const ok = Object.entries(results).filter(([, r]) => r.ok).map(([k]) => k).join(", ");
    const fail = Object.entries(results).filter(([, r]) => !r.ok).map(([k, r]) => `❌ ${k}: ${(r.error || "").slice(0, 100)}`).join("\n");

    await notifyAdmin(`✅ <b>${product.niche}</b> post ho gaya!\n📦 ${product.title.slice(0, 80)}\n✔️ ${ok || "—"}` + (fail ? `\n${fail}` : ""));
    await setStatus(product.id, "done", { videoUrl, results: JSON.stringify(results) });
    return product.id;
  } catch (e) {
    console.log("[QUEUE] instant post fail:", e.message);
    await setStatus(product.id, "failed", { error: String(e.message || e).slice(0, 300) });
    throw e;
  }
}

// Ab queue kabhi nahi badhegi, hamesha 0 dikhegi
async function popNext() { return null; }
async function queueLength() { return 0; }
async function clearQueue() { return 0; }

async function setStatus(id, status, extra = {}) {
  console.log(`[STATUS] ${id} -> ${status}`);
}

module.exports = { pushJob, popNext, queueLength, clearQueue, setStatus };
