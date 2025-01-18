const puppeteer = require('puppeteer')
const { MAX_PAGES } = require('../config/config')

let browser = null
let pageQueue = []

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    // Tạo sẵn pool page
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await browser.newPage()
      pageQueue.push(page)
    }
    console.log(`[Puppeteer] Browser launched, pool size = ${MAX_PAGES}`)
  }
}

// Lấy 1 page từ pool. Nếu hết page rảnh thì chờ
async function getPageFromPool() {
  if (pageQueue.length > 0) {
    return pageQueue.pop()
  } else {
    // hoặc tùy biến chờ (blocking)
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (pageQueue.length > 0) {
          clearInterval(interval)
          resolve(pageQueue.pop())
        }
      }, 200) // check 5 lần/giây
    })
  }
}

// Trả page về pool
function releasePageToPool(page) {
  pageQueue.push(page)
}

async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
    pageQueue = []
  }
}

module.exports = {
  initBrowser,
  getPageFromPool,
  releasePageToPool,
  closeBrowser
}
