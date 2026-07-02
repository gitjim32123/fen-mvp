import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const expoConstants = { default: { expoConfig: { extra: {} } } };
const sharedProcess = { env: {} };

function loadTsModule(path, overrides = {}) {
  const sourcePath = resolve(path);
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: sharedProcess,
    fetch: undefined,
    require: (name) => {
      if (overrides[name]) return overrides[name];
      if (name === "expo-constants") {
        return expoConstants;
      }
      throw new Error(`Unexpected require: ${name}`);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox;
}

const routeAiAgentSandbox = loadTsModule("lib/routeAiAgent.ts");
const sandbox = loadTsModule("lib/routeQuotes.ts", {
  "./routeAiAgent": routeAiAgentSandbox.module.exports,
});
const routeQuotes = sandbox.module.exports;

assert.equal(routeQuotes.isRouteQuotesEnabled(), false);
sharedProcess.env.EXPO_PUBLIC_ENABLE_ROUTE_QUOTES = "true";
assert.equal(routeQuotes.isRouteQuotesEnabled(), true);
sharedProcess.env.EXPO_PUBLIC_ENABLE_ROUTE_QUOTES = "";
sandbox.require("expo-constants").default.expoConfig.extra.ENABLE_ROUTE_QUOTES = true;
assert.equal(routeQuotes.isRouteQuotesEnabled(), true);

sharedProcess.env.EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL = "http://route-api.test/";
assert.equal(routeQuotes.getRouteAiAgentBaseUrl(), "http://route-api.test");

assert.equal(routeQuotes.formatRouteQuoteDuration(28 * 60), "28 min");
assert.equal(routeQuotes.formatRouteQuoteDistance(2100), "2.1 km");
assert.equal(
  routeQuotes.formatRouteQuoteCost({
    mode: "bus",
    status: "available",
    fare: { status: "available", amount_pence: 250 },
  }),
  "\u00A32.50"
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
assert.equal(
  routeQuotes.routeQuoteStatusText({
    mode: "bus",
    status: "failed",
    error: {
      code: "OUTSIDE_SERVICE_PERIOD",
      message:
        "No transit times available. The date may be past or too far in the future or there may not be transit service for your trip at the time you chose.",
    },
  }),
  "Bus routes unavailable for this time"
);
const decodedGeometry = routeQuotes.decodeEncodedPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
assert.equal(decodedGeometry.length, 3);
assert.equal(decodedGeometry[0].latitude, 38.5);
assert.equal(decodedGeometry[0].longitude, -120.2);
assert.equal(routeQuotes.decodeEncodedPolyline("not valid").length, 0);

const routeGeometry = routeQuotes.routeGeometryFromQuote({
  mode: "walk",
  status: "available",
  legs: [
    { mode: "WALK", geometry: "_p~iF~ps|U_ulLnnqC" },
    { mode: "WALK", geometry: "_mqNvxq`@" },
  ],
});
assert.equal(routeGeometry.source, "route_ai_agent");
assert.equal(routeGeometry.mode, "walk");
assert.equal(routeGeometry.points.length, 3);

let capturedRequest = null;
sharedProcess.env.EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL = "http://localhost:8000";
sandbox.fetch = async (url, options) => {
  capturedRequest = { url, options };
  return {
    ok: true,
    json: async () => ({
      routes: [
        {
          mode: "walk",
          status: "available",
          legs: [{ mode: "WALK", distance_meters: 1200, duration_seconds: 900, geometry: "_p~iF~ps|U" }],
        },
      ],
    }),
  };
};

const routeQuoteResponse = await routeQuotes.fetchRouteQuotes(
  { latitude: 53.5, longitude: -1.1 },
  { latitude: 53.6, longitude: -1.2 }
);

assert.equal(routeQuoteResponse.routes[0].legs[0].geometry, "_p~iF~ps|U");
assert.equal(capturedRequest.url, "http://localhost:8000/v1/routes/plan");
const body = JSON.parse(capturedRequest.options.body);
assert.deepEqual(body.origin, { lat: 53.5, lon: -1.1 });
assert.deepEqual(body.destination, { lat: 53.6, lon: -1.2 });
assert.deepEqual(body.modes, ["walk", "bicycle", "car", "bus"]);
assert.equal(body.time.mode, "depart_at");

const partialRequests = [];
sandbox.fetch = async (url, options) => {
  const modes = JSON.parse(options.body).modes;
  partialRequests.push(modes);
  if (modes.length > 1) {
    return {
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: "OUTSIDE_SERVICE_PERIOD",
          message:
            "No transit times available. The date may be past or too far in the future or there may not be transit service for your trip at the time you chose.",
        },
      }),
    };
  }
  const mode = modes[0];
  if (mode === "bus") {
    return {
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: "OUTSIDE_SERVICE_PERIOD",
          message:
            "No transit times available. The date may be past or too far in the future or there may not be transit service for your trip at the time you chose.",
        },
      }),
    };
  }
  return {
    ok: true,
    json: async () => ({
      routes: [
        {
          mode,
          status: "available",
          distance_meters: 1200,
          duration_seconds: 900,
          legs: [{ mode: mode.toUpperCase(), geometry: "_p~iF~ps|U" }],
        },
      ],
    }),
  };
};

const partialRouteResponse = await routeQuotes.fetchRouteQuotes(
  { latitude: 53.5, longitude: -1.1 },
  { latitude: 53.6, longitude: -1.2 }
);
assert.deepEqual(partialRequests, [["walk", "bicycle", "car", "bus"], ["walk"], ["bicycle"], ["car"], ["bus"]]);
assert.equal(partialRouteResponse.routes.find((route) => route.mode === "walk").status, "available");
assert.equal(partialRouteResponse.routes.find((route) => route.mode === "bicycle").status, "available");
assert.equal(partialRouteResponse.routes.find((route) => route.mode === "car").status, "available");
const unavailableBusRoute = partialRouteResponse.routes.find((route) => route.mode === "bus");
assert.equal(unavailableBusRoute.status, "unavailable");
assert.equal(routeQuotes.routeQuoteStatusText(unavailableBusRoute), "Bus routes unavailable for this time");

sandbox.fetch = async () => {
  throw new TypeError("Failed to fetch");
};
await assert.rejects(
  () => routeQuotes.fetchRouteQuotes(
    { latitude: 53.5, longitude: -1.1 },
    { latitude: 53.6, longitude: -1.2 }
  ),
  /Route service unavailable/
);
assert.equal(routeQuotes.routeQuoteFailureMessage(new TypeError("Failed to fetch")), "Route service unavailable");

console.log("route quote tests passed");
