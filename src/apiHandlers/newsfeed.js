const { match } = require("path-to-regexp");

const matchers = [
  match("/guest/construction/:idConstruction/newsfeed-builder/:id"),
  match("/construction/:idConstruction/newsfeed-builder/:id"),
  match("/guest/newsfeed-builder/:id"),
  match("/newsfeed-builder/:id"),
];

module.exports = (axios) => ({
  name: "constructionNewsfeed",
  match: (pathname) => {
    for (const m of matchers) {
      const result = m(pathname);
      if (result) return result.params; // { idConstruction, id }
    }
    return null;
  },
  fetchMeta: async ({ id, url }) => {
    const res = await axios.get(`/guest/newsfeeds/${id}`);
    const post = res.data.data;
    const files = post.files || [];
    const defaultImage = "https://homesoon.jp/images/preview-logo.png";

    const firstImage = files.find((file) =>
      file.mime_type?.startsWith("image/")
    );
    const firstThumb = files.find((file) => file.thumbnail_url);

    const imageMeta = firstImage
      ? firstImage.url
      : firstThumb
      ? firstThumb.thumbnail_url
      : defaultImage;

    return {
      title: post.title || "",
      description: post.content || "",
      ogImage: imageMeta,
      url,
    };
  },
});
