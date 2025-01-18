module.exports = {
  PORT: process.env.PORT || 3001,
  // Giới hạn số tab cho 1 instance browser
  MAX_PAGES: parseInt(process.env.MAX_PAGES) || 5,
  // Thời gian chờ (ms) để Puppeteer render
  RENDER_TIMEOUT: parseInt(process.env.RENDER_TIMEOUT) || 30000,
  // TTL cache (giây)
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300, // 5 phút
  // v.v...
}
