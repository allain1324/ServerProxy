function findMatchingHandler(handlers, url) {
  const { pathname } = new URL(url);
  for (const handler of handlers) {
    const match = handler.match(pathname);
    if (match) return { handler, params: match };
  }
  return null;
}

module.exports = { findMatchingHandler };
