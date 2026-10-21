// lib/queue.js — Upstash Redis based product queue
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const QUEUE_KEY = "aura:queue";
const prodKey = (id) => `aura:product:${id}`;

// Naya product queue me daalo
async function pushProduct(p) {
  const id = "p" + Date.now().toString(36);
  const product = { ...p, id, status: "queued", createdAt: new Date().toISOString() };
  await redis.hset(prodKey(id), product);
  await redis.rpush(QUEUE_KEY, id);
  return id;
}

// Agla product nikaalo (cron ke liye)
async function popNext() {
  const id = await redis.lpop(QUEUE_KEY);
  if (!id) return null;
  const p = await redis.hgetall(prodKey(id));
  if (!p || !p.id) return null;
  return p;
}

async function setStatus(id, status, extra = {}) {
  await redis.hset(prodKey(id), { status, ...extra });
}
