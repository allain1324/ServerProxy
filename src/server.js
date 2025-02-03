const express = require("express");
const { chromium } = require("playwright");
const redis = require("redis");
const { Semaphore } = require("async-mutex");
const cheerio = require("cheerio");

// Environment variables
const PORT = process.env.PORT || 3001;
const RENDER_TIMEOUT = parseInt(process.env.RENDER_TIMEOUT) || 60000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutes
const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379;
const MAX_CONCURRENT_PAGES = parseInt(process.env.MAX_CONCURRENT_PAGES) || 20;
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || '')
  .split(',')
  .map(d => d.trim())
  .filter(Boolean);

const app = express();

// Initialize Redis client
const redisClient = redis.createClient({
  socket: { host: REDIS_HOST, port: REDIS_PORT },
});
redisClient.on("error", (err) => console.error("Redis error", err));

(async () => {
  await redisClient.connect();
  console.log("Redis connected");
})();

// Launch browser
let browser;
(async () => {
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Playwright browser launched");
  } catch (err) {
    console.error("Failed to launch browser:", err);
    process.exit(1);
  }
})();

// Semaphore to limit concurrency
const semaphore = new Semaphore(MAX_CONCURRENT_PAGES);

// The render route
app.get("/render", async (req, res) => {
  const targetUrl = req.query.url;
  console.log("render", targetUrl);
  if (!targetUrl) {
    return res.status(400).send("Missing ?url=");
  }

  try {
    const urlObj = new URL(targetUrl);
    console.log('hostname', urlObj.hostname)
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return res.status(403).send("Forbidden domain");
    }
  } catch (error) {
    return res.status(400).send("Invalid URL");
  }

  console.log("haveDomain", targetUrl);
  // Check cache
  try {
    const cached = await redisClient.get(targetUrl);
    if (cached) {
      res.set("Content-Type", "text/html; charset=utf-8");
      console.log("haveCached", cached, new Date());
      return res.send(cached);
    }
  } catch (err) {
    console.error("Redis GET error:", err);
  }

  // Acquire semaphore
  const [value, release] = await semaphore.acquire();

  try {
    const page = await browser.newPage();
    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: RENDER_TIMEOUT,
    });
    // await page.waitForTimeout(1000);
    const html = await page.content();
    await page.close();

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);

    // Extract specific meta tags
    const metaTags = $("head")
      .find(
        `
      meta[property^="og:"],
      meta[name^="twitter:"],
      meta[name="description"],
      title
    `
      )
      .toArray()
      .map((tag) => $.html(tag));

    // Include the title tag
    const titleTag = $("head").find("title").first().toString();

    // Combine all extracted tags
    const combinedMeta = [titleTag, ...metaTags].join("\n    ");

    // Create minimal HTML document with extracted meta tags
    const minimalHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    ${combinedMeta}
  </head>
  <body>
  </body>
</html>
    `.trim();

    // console.log("minimalHtml", minimalHtml);
    // Store in cache
    try {
      await redisClient.setEx(targetUrl, CACHE_TTL, minimalHtml);
    } catch (err) {
      console.error("Redis SET error:", err);
    }

    res.set("Content-Type", "text/html; charset=utf-8");
    console.log('resNewHtml', new Date());
    return res.send(minimalHtml);
  } catch (error) {
    console.error(`Error rendering page (${targetUrl}):`, error);
    return res.status(500).send("Internal Server Error");
  } finally {
    release();
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Headless SEO server is running!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Headless SEO server listening on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  if (browser) {
    await browser.close();
  }
  await redisClient.disconnect();
  process.exit(0);
});
