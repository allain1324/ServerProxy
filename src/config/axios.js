const axios = require("axios");

const axiosInstance = axios.create({
  baseURL: process.env.API_BASE_URL || "https://your.api",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
    // Authorization: `Bearer ${process.env.API_TOKEN}` // nếu cần
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    // Log request details
    console.log(`🔗 Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    // Log request error
    console.error("❌ Request error:", error.message);
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    // Log response details
    console.log(`📥 Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    // Log response error
    if (error.response) {
      console.error(
        `❌ Response error: ${error.response.status} ${error.response.config.url}`
      );
    } else {
      console.error("❌ Response error:", error.message);
    }
    return Promise.reject(error);
  }
);

module.exports = axiosInstance;
