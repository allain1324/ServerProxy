const { match } = require("path-to-regexp");

const matchers = [
  match("/campaign/builder-event/:id"),
  match("/campaign/events-share/:id"),
  match("/guest/event/:id"),
];

module.exports = (axios) => ({
  name: "builderEvent",
  match: (pathname) => {
    for (const m of matchers) {
      const result = m(pathname);
      if (result) return result.params; // { idConstruction, id }
    }
    return null;
  },
  fetchMeta: async ({ id, url }) => {
    const res = await axios.get(`/guest/events/${id}`);
    const post = res.data.data;

    return {
      title: post.title || "",
      description: post.description || "",
      ogImage: post.image_url,
      url,
    };
  },
});
