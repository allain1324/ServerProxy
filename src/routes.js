const express = require('express')
const router = express.Router()
const { getPageFromPool, releasePageToPool } = require('./pagePool')
const { getCache, setCache } = require('./cache')
const { RENDER_TIMEOUT } = require('../config/config')

// GET /render?url=https://your-spa-site.com/abc
router.get('/render', async (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) {
    return res.status(400).send('Missing ?url=')
  }

  // (Tuỳ chọn) Kiểm tra domain, tránh bị dùng làm proxy
  const isValidDomain = targetUrl.startsWith('https://myhome.vi-jp-te.info')
  if (!isValidDomain) {
    return res.status(403).send('Forbidden domain')
  }

  // Kiểm tra cache trước
  const cachedHtml = getCache(targetUrl)
  if (cachedHtml) {
    // Trả ngay HTML cache
    res.set('Content-Type', 'text/html; charset=UTF-8')
    return res.send(cachedHtml)
  }

  let page
  try {
    // Mượn page từ pool
    page = await getPageFromPool()
    // Điều hướng đến URL, chờ load xong
    await page.goto(targetUrl, {
      waitUntil: 'networkidle0',
      timeout: RENDER_TIMEOUT
    })

    // Lấy HTML đã render
    const html = await page.content()

    // Lưu cache
    setCache(targetUrl, html)

    res.set('Content-Type', 'text/html; charset=UTF-8')
    return res.send(html)
  } catch (error) {
    console.error('Error rendering page:', error)
    return res.status(500).send('Internal Server Error')
  } finally {
    if (page) {
      // Xoá cookie để tránh dính session
      const cookies = await page.cookies()
      if (cookies.length > 0) {
        await page.deleteCookie(...cookies)
      }
      // (Tuỳ chọn) Xoá localStorage, sessionStorage
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })

      // Trả page về pool
      releasePageToPool(page)
    }
  }
})

// Route kiểm tra status server
router.get('/', (req, res) => {
  res.send('Headless SEO server is running!')
})

module.exports = router
