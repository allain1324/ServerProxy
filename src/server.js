const express = require('express')
const routes = require('./routes')
const { initBrowser } = require('./pagePool')
const { PORT } = require('../config/config')

async function startServer() {
  const app = express()

  // Khởi tạo browser + page pool
  await initBrowser()

  // Sử dụng routes
  app.use(routes)

  // Lắng nghe cổng
  app.listen(PORT, () => {
    console.log(`Headless SEO server listening at http://localhost:${PORT}`)
  })
}

// Bắt đầu
startServer().catch((err) => {
  console.error('Error starting server:', err)
  process.exit(1)
})
