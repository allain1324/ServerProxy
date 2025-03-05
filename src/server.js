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
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
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
    console.log("hostname", urlObj.hostname);
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
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    });

    // Log tất cả response để debug
    page.on("response", (response) => {
      const request = response.request();
      const resourceType = request.resourceType();
      const url = response.url();

      // Chỉ log request chính và không phải tài nguyên tĩnh
      if (
        resourceType === "document" &&
        !url.match(
          /\.(js|css|png|jpg|jpeg|gif|svg|mp4|webm|ogg|woff|woff2|ttf|eot)$/i
        )
      ) {
        console.log("Response:", url, response.status(), response.headers());
      }
    });

    // Goto URL ban đầu
    console.log("Starting page.goto for:", targetUrl);
    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: RENDER_TIMEOUT,
    });
    console.log("Initial URL:", await page.url());

    // Chờ redirect đến URL chứa /guest/ hoặc timeout sau 5 giây
    let finalUrl = await page.url();
    if (!finalUrl.includes("/guest/")) {
      console.log("Waiting for redirect to /guest/...");
      try {
        await page.waitForURL("**/guest/**", { timeout: 5000 }); // Chờ tối đa 5 giây
        finalUrl = await page.url();
        console.log("Redirect detected, Final URL:", finalUrl);
      } catch (e) {
        console.log(
          "No redirect to /guest/ within 5s, using current URL:",
          finalUrl
        );
      }
    } else {
      console.log("Already at /guest/, Final URL:", finalUrl);
    }

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
    console.log("resNewHtml", new Date(), minimalHtml);
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
