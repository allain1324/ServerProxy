const { chromium } = require("playwright");

let browser;

async function launchBrowser(url) {
  if (!browser) {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  }
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForSelector('meta[property="og:title"]', { timeout: 6000 });
  const html = await page.content();
  await page.close();
  return html;
}

module.exports = { launchBrowser };