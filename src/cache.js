const NodeCache = require('node-cache')
const { CACHE_TTL } = require('../config/config')

// Khởi tạo cache (thời gian sống mặc định = CACHE_TTL)
const cache = new NodeCache({ stdTTL: CACHE_TTL })

// Hàm lấy dữ liệu từ cache
function getCache(key) {
  return cache.get(key)
}

// Hàm lưu dữ liệu vào cache
function setCache(key, value, ttl = CACHE_TTL) {
  return cache.set(key, value, ttl)
}

module.exports = {
  getCache,
  setCache
}
