const appJson = require("./app.json");

const expo = appJson.expo;

module.exports = {
  ...expo,
  extra: {
    ...expo.extra,
    ENABLE_ROUTE_QUOTES:
      process.env.ENABLE_ROUTE_QUOTES === "true" ||
      process.env.EXPO_PUBLIC_ENABLE_ROUTE_QUOTES === "true",
    ROUTE_AI_AGENT_BASE_URL:
      process.env.ROUTE_AI_AGENT_BASE_URL ||
      process.env.EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL ||
      "http://localhost:8000",
  },
};
