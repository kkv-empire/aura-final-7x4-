// lib/queue.js — Upstash Redis queue (LAZY: import pe kabhi crash nahi)
const QUEUE_KEY = "aura:queue";
const prodKey = (id) => `aura:product:${id}`;

let _redis = null;
function redis() {
  if (_redis) return _redis;
  const { Redis } = require("@upstash/redis");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing");
  _redis = new Redis({ url, token });
  return _redis;
}

async function pushProduct(p) {
  const id = "p" + Date.now().toString(36);
  const product = { ...p, id, status: "queued", createdAt: new Date().toISOString() };
  await redis().hset(prodKey(id), product);
  await redis().rpush(QUEUE_KEY, id);
  return id;
}

async function popNext() {
  const id = await redis().lpop(QUEUE_KEY);
  if (!id) return null;
  const p = await redis().hgetall(prodKey(id));
  if (!p || !p.id) return null;
  return p;
}

async function setStatus(id, status, extra = {}) {
  await redis().hset(prodKey(id), { status, ...extra });
}

async function queueLength() {
  return await redis().llen(QUEUE_KEY);
}

module.exports = { pushProduct, popNext, setStatus, queueLength };
