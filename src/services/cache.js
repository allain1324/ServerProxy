const redis = require("redis");
const { REDIS_HOST, REDIS_PORT, CACHE_TTL } = require("../config");

let client;

async function connectRedis() {
  client = redis.createClient({ socket: { host: REDIS_HOST, port: REDIS_PORT } });
  client.on("error", console.error);
  await client.connect();
}

async function getFromCache(key) {
  return client.get(key);
}

async function saveToCache(key, value) {
  await client.setEx(key, CACHE_TTL, value);
}

async function disconnectRedis() {
  if (client) await client.disconnect();
}

module.exports = { connectRedis, disconnectRedis, getFromCache, saveToCache };