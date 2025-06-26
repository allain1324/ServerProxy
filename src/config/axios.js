const axios = require("axios");

const axiosInstance = axios.create({
  baseURL: process.env.API_BASE_URL || "https://your.api",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
    // Authorization: `Bearer ${process.env.API_TOKEN}` // nếu cần
  },
});

module.exports = axiosInstance;
