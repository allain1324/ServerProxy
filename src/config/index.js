require("dotenv").config();

module.exports = {
  API_BASE_URL: process.env.API_BASE_URL || "",
  PORT: process.env.PORT || 3001,
  RENDER_TIMEOUT: parseInt(process.env.RENDER_TIMEOUT) || 20000,
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300,
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  MAX_CONCURRENT_PAGES: parseInt(process.env.MAX_CONCURRENT_PAGES) || 10,
};
