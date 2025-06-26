function isDynamicLink(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const pathParts = pathname.split("/").filter((part) => part.length > 0);

    const lastPart = pathParts[pathParts.length - 1];

    // Regex khớp với Base64 URL-safe: [a-zA-Z0-9_-], độ dài 16
    const randomStringRegex = /^[a-zA-Z0-9_-]{16}$/;

    return randomStringRegex.test(lastPart);
  } catch (e) {
    return false;
  }
}

module.exports = {
  isDynamicLink,
};
