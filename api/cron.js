// api/cron.js - Queue se 1 product nikal ke 4 platforms pe post karo
const { Redis } = require("@upstash/redis");

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis env missing");
  return new Redis({ url, token });
}

module.exports = async (req, res) => {
  try {
    const redis = getRedis();
    const id = await redis.lpop("aura:queue");
    if (!id) {
      return res.status(200).json({ done: true, message: "Queue khaali hai", version: "cron-clean-v1" });
    }

    const product = await redis.hgetall(`aura:product:${id}`);
    if (!product || !product.title) {
      return res.status(200).json({ done: true, message: "Product nahi mila, skip kiya", id });
    }

    console.log("Cron processing:", id, product.title, product.niche);

    // Distributor ko bulao - Video + 4 platforms
    const { distribute } = require("../lib/distributor");
    const result = await distribute(product);

    await redis.hset(`aura:product:${id}`, { status: "done", postedAt: new Date().toISOString() });
    return res.status(200).json({ done: true, id, title: product.title, result, version: "cron-clean-v1" });

  } catch (e) {
    console.error("Cron error:", e);
    return res.status(200).json({ done: false, stage: "cron-run", error: String(e.message || e), version: "cron-clean-v1" });
  }
};
