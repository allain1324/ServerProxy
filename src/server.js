const express = require("express");
const cheerio = require("cheerio");
const app = express();
const config = require("./config");
const handlers = require("./apiHandlers");
const axiosInstance = require("./config/axios");
const { findMatchingHandler } = require("./utils/match-url");
const { buildMetaHtml } = require("./services/metaBuilder");
const {
  getFromCache,
  saveToCache,
  connectRedis,
  disconnectRedis,
} = require("./services/cache");
const { launchBrowser } = require("./services/playwright");
const { isDynamicLink } = require("./utils/link");

(async () => {
  await connectRedis();

  app.get("/", (_, res) => res.send("✅ Meta preview service running"));

  app.get("/render", async (req, res) => {
    let targetUrl = req.query.url;
    const isDynamicUrl = isDynamicLink(targetUrl);
    console.log("🔍 Fetching URL:", targetUrl, isDynamicUrl);
    if (isDynamicUrl) {
      // If the URL is dynamic, we need to decode it
      try {
        const dataResResolve = await axiosInstance.get(
          `/resolve-link?shortLink=${targetUrl}`
        );
        targetUrl = dataResResolve.data.data;
      } catch (err) {
        console.error("❌ Invalid URL encoding:", err.message);
        return res.status(400).send("Invalid URL encoding");
      }
    }

    if (!targetUrl) return res.status(400).send("Missing ?url=");

    const cached = await getFromCache(targetUrl);
    console.log("Have cached data:", !!cached);
    if (cached)
      return res.set("Content-Type", "text/html; charset=utf-8").send(cached);

    const matched = findMatchingHandler(handlers, targetUrl);
    if (matched) {
      try {
        const meta = await matched.handler.fetchMeta({
          ...matched.params,
          url: targetUrl,
        });
        const html = buildMetaHtml(meta);
        await saveToCache(targetUrl, html);
        return res.set("Content-Type", "text/html; charset=utf-8").send(html);
      } catch (err) {
        console.error("❌ API fetch failed:", err.message);
      }
    }

    // try {
    //   const html = await launchBrowser(targetUrl);
    //   const $ = cheerio.load(html);
    //   const tags = $("head")
    //     .find('meta[property^="og:"], meta[name^="twitter:"], title')
    //     .toArray()
    //     .map((t) => $.html(t));
    //   if (!tags.some((t) => t.includes('property="og:url"')))
    //     tags.push(`<meta property="og:url" content="${targetUrl}">`);
    //   const fallbackHtml = `<!DOCTYPE html><html lang="en"><head>
    //     ${tags.join("\n")}
    //   </head><body></body></html>`;
    //   await saveToCache(targetUrl, fallbackHtml);
    //   return res
    //     .set("Content-Type", "text/html; charset=utf-8")
    //     .send(fallbackHtml);
    // } catch (err) {
    //   console.error("❌ Fallback Playwright failed:", err.message);
    //   return res.status(500).send("Internal Server Error");
    // }
  });

  app.listen(config.PORT, () =>
    console.log(`🚀 Server listening on port ${config.PORT}`)
  );
})();

process.on("SIGINT", async () => {
  console.log("🛑 Shutting down...");
  await disconnectRedis();
  process.exit(0);
});
