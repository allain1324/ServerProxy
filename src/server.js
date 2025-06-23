const express = require("express");
const { chromium } = require("playwright");
const redis = require("redis");
const { Semaphore } = require("async-mutex");
const cheerio = require("cheerio");

const PORT = process.env.PORT || 3001;
const RENDER_TIMEOUT = parseInt(process.env.RENDER_TIMEOUT) || 60000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300; // seconds
const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379;
const MAX_CONCURRENT_PAGES = parseInt(process.env.MAX_CONCURRENT_PAGES) || 20;
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

const app = express();

// Redis client
const redisClient = redis.createClient({
  socket: { host: REDIS_HOST, port: REDIS_PORT },
});
redisClient.on("error", (err) => console.error("Redis error", err));
(async () => {
  await redisClient.connect();
  console.log("✅ Redis connected");
})();

// Launch Playwright browser
let browser;
(async () => {
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("✅ Playwright browser launched");
  } catch (err) {
    console.error("❌ Failed to launch browser:", err);
    process.exit(1);
  }
})();

const semaphore = new Semaphore(MAX_CONCURRENT_PAGES);

app.get("/render", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("Missing ?url=");
  }

  // Validate URL & domain
  try {
    const urlObj = new URL(targetUrl);
    if (!ALLOWED_DOMAINS.includes(urlObj.hostname)) {
      return res.status(403).send("Forbidden domain");
    }
  } catch (error) {
    return res.status(400).send("Invalid URL");
  }

  // Check cache
  try {
    const cached = await redisClient.get(targetUrl);
    if (cached) {
      res.set("Content-Type", "text/html; charset=utf-8");
      console.log("✅ Cached response served");
      return res.send(cached);
    }
  } catch (err) {
    console.error("Redis GET error:", err);
  }

  const [value, release] = await semaphore.acquire();
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("Page console error:", msg.text());
      }
    });

    console.log("➡️ Opening:", targetUrl);
    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: RENDER_TIMEOUT,
    });

    // Optional wait for client redirect to /guest/
    let finalUrl = await page.url();
    if (!finalUrl.includes("/guest/")) {
      try {
        await page.waitForURL("**/guest/**", { timeout: 30000 });
        finalUrl = await page.url();
        console.log("🔁 Redirected to:", finalUrl);
      } catch {
        console.log("⏱ No redirect detected, continuing...");
      }
    }

    // ✅ Wait for key meta tags to appear (client-side Vue render complete)
    try {
      const dataRes = await page.waitForSelector(
        'meta[property="og:title"], meta[name="description"]',
        {
          timeout: 30000,
        }
      );
      console.log("✅ Meta tags rendered.", dataRes);
    } catch {
      console.warn("⚠️ Meta tags not found in time, continuing anyway.");
    }

    const html = await page.content();
    await page.close();

    // Cheerio parse
    const $ = cheerio.load(html);
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

    // Add fallback og:url and twitter:url
    if (!metaTags.some((t) => t.includes('property="og:url"'))) {
      metaTags.push(`<meta property="og:url" content="${targetUrl}">`);
    }
    if (!metaTags.some((t) => t.includes('name="twitter:url"'))) {
      metaTags.push(`<meta name="twitter:url" content="${targetUrl}">`);
    }

    const minimalHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    ${metaTags.join("\n    ")}
  </head>
  <body></body>
</html>`.trim();

    // Save to Redis
    try {
      await redisClient.setEx(targetUrl, CACHE_TTL, minimalHtml);
      console.log("💾 Cached to Redis", minimalHtml);
    } catch (err) {
      console.error("Redis SET error:", err);
    }

    res.set("Content-Type", "text/html; charset=utf-8");
    return res.send(minimalHtml);
  } catch (err) {
    console.error(`❌ Error rendering ${targetUrl}:`, err);
    return res.status(500).send("Internal Server Error");
  } finally {
    release();
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ Headless SEO service running");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down...");
  if (browser) await browser.close();
  await redisClient.disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
