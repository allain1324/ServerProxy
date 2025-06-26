function buildMetaHtml(meta) {
  const metaTags = [
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
    { name: 'title', content: meta.title },
    { name: 'description', content: meta.description },

    // Open Graph
    { property: 'og:title', content: meta.title },
    { property: 'og:description', content: meta.description },
    { property: 'og:image', content: meta.ogImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: meta.title },
    { property: 'og:site_name', content: 'HomeSoon' },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: meta.url },

    // Twitter Cards
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: '@ホムすんビジネス' },
    { name: 'twitter:creator', content: '@ホムすんビジネス' },
    { name: 'twitter:title', content: meta.title },
    { name: 'twitter:description', content: meta.description },
    { name: 'twitter:image', content: meta.ogImage },
    { name: 'twitter:image:alt', content: meta.title },
    { name: 'twitter:url', content: meta.url },
  ];

  const tags = metaTags.map((tag) => {
    const attrs = Object.entries(tag)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");
    return `<meta ${attrs}>`;
  });

  return `<!DOCTYPE html><html lang="en"><head>
    <title>${meta.title}</title>
    ${tags.join("\n    ")}
  </head><body></body></html>`;
}

module.exports = { buildMetaHtml };