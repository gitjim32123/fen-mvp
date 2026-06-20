import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = resolve("lib/routeQuotes.ts");
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const expoConstants = { default: { expoConfig: { extra: {} } } };
const sandbox = {
  exports: {},
  module: { exports: {} },
  process: { env: {} },
  fetch: undefined,
  require: (name) => {
    if (name === "expo-constants") {
      return expoConstants;
    }
    throw new Error(`Unexpected require: ${name}`);
  },
};
sandbox.module.exports = sandbox.exports;

vm.runInNewContext(compiled, sandbox, { filename: sourcePath });

const routeQuotes = sandbox.module.exports;

assert.equal(routeQuotes.isRouteQuotesEnabled(), false);
sandbox.process.env.EXPO_PUBLIC_ENABLE_ROUTE_QUOTES = "true";
assert.equal(routeQuotes.isRouteQuotesEnabled(), true);
sandbox.process.env.EXPO_PUBLIC_ENABLE_ROUTE_QUOTES = "";
sandbox.require("expo-constants").default.expoConfig.extra.ENABLE_ROUTE_QUOTES = true;
assert.equal(routeQuotes.isRouteQuotesEnabled(), true);

sandbox.process.env.EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL = "http://route-api.test/";
assert.equal(routeQuotes.getRouteAiAgentBaseUrl(), "http://route-api.test");

assert.equal(routeQuotes.formatRouteQuoteDuration(28 * 60), "28 min");
assert.equal(routeQuotes.formatRouteQuoteDistance(2100), "2.1 km");
assert.equal(
  routeQuotes.formatRouteQuoteCost({
    mode: "bus",
    status: "available",
    fare: { status: "available", amount_pence: 250 },
  }),
  "£2.50"
);
assert.equal(
  routeQuotes.formatRouteQuoteCost({
    mode: "walk",
    status: "available",
    cost: { status: "available", amount_pence: 0 },
  }),
  "Free"
);
assert.equal(
  routeQuotes.formatRouteQuoteCost({
    mode: "bus",
    status: "available",
    fare: { status: "unavailable", amount_pence: null },
  }),
  null
);
assert.equal(
  routeQuotes.routeQuoteStatusText({
    mode: "bus",
    status: "available",
    fare: { status: "unavailable", reason: "No matching fare product found." },
  }),
  "No matching fare product found."
);

let capturedRequest = null;
sandbox.process.env.EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL = "http://localhost:8000";
sandbox.fetch = async (url, options) => {
  capturedRequest = { url, options };
  return {
    ok: true,
    json: async () => ({ routes: [] }),
  };
};

await routeQuotes.fetchRouteQuotes(
  { latitude: 53.5, longitude: -1.1 },
  { latitude: 53.6, longitude: -1.2 }
);

assert.equal(capturedRequest.url, "http://localhost:8000/v1/routes/plan");
const body = JSON.parse(capturedRequest.options.body);
assert.deepEqual(body.origin, { lat: 53.5, lon: -1.1 });
assert.deepEqual(body.destination, { lat: 53.6, lon: -1.2 });
assert.deepEqual(body.modes, ["walk", "bicycle", "car", "bus"]);
assert.equal(body.time.mode, "depart_at");

console.log("route quote tests passed");
