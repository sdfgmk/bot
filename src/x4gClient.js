const axios = require("axios");
const config = require("./config");

const client = axios.create({
  baseURL: config.X4G_BASE_URL,
  timeout: 20000,
  headers: {
    "X-API-Key": config.X4G_BOT_API_KEY,
    "Content-Type": "application/json",
  },
});

async function createConfig(label, gb, days, ipLimit) {
  const { data } = await client.post("/api/bot/configs", { label, gb, days, ip_limit: ipLimit });
  return data;
}

async function getConfigStatus(uid) {
  const { data } = await client.get(`/api/bot/configs/${uid}`);
  return data;
}

async function renewConfig(uid, gb, days, resetUsage = true) {
  const { data } = await client.post(`/api/bot/configs/${uid}/renew`, {
    gb,
    days,
    reset_usage: resetUsage,
  });
  return data;
}

async function disableConfig(uid) {
  const { data } = await client.post(`/api/bot/configs/${uid}/disable`);
  return data;
}

module.exports = { createConfig, getConfigStatus, renewConfig, disableConfig };
