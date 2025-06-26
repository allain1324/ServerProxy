const axios = require("../config/axios");

const handlers = [
  require("./newsfeed"),
  require("./campaign"),
];

module.exports = handlers.map((handlerFactory) => handlerFactory(axios));
