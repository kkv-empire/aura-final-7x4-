// lib/queue.js — Vercel pe memory nahi chalegi, isliye Upstash Redis use karo
// Vercel me env daalo: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const QUEUE_KEY = "aura:queue";
const STATUS_PREFIX = "aura:status:";

let memQueue = []; // Redis nahi hai to fallback ke liye

async function redisCmd(path, body) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json();
    return j.result;
  } catch (e) { console.log("[REDIS] fail:", e.message); return null; }
}

async function pushJob(product) {
  product.id = product.id || `p_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  if (REDIS_URL) {
    await redisCmd("/rpush/" + QUEUE_KEY, [JSON.stringify(product)]);
  } else {
    memQueue.push(product);
  }
  return product.id;
}

async function popNext() {
  if (REDIS_URL) {
    const raw = await redisCmd("/lpop/" + QUEUE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  return memQueue.shift() || null;
}

async function queueLength() {
  if (REDIS_URL) {
    const len = await redisCmd("/llen/" + QUEUE_KEY);
    return Number(len || 0);
  }
  return memQueue.length;
}

async function clearQueue() {
  if (REDIS_URL) await redisCmd("/del/" + QUEUE_KEY);
  memQueue.length = 0;
  return 0;
}

async function setStatus(id, status, extra = {}) {
  const data = JSON.stringify({ status, ...extra, at: Date.now() });
  if (REDIS_URL) await redisCmd("/set/" + STATUS_PREFIX + id, [data]);
  console.log(`[STATUS] ${id} -> ${status}`);
}

module.exports = { pushJob, popNext, queueLength, clearQueue, setStatus };
