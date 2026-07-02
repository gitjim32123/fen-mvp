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
      if (name === "expo-constants") return expoConstants;
      throw new Error(`Unexpected require: ${name}`);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox;
}

const routeAiAgentSandbox = loadTsModule("lib/routeAiAgent.ts");
const profitabilitySandbox = loadTsModule("lib/profitability.ts", {
  "./routeAiAgent": routeAiAgentSandbox.module.exports,
});
const routeQuotesSandbox = loadTsModule("lib/routeQuotes.ts", {
  "./routeAiAgent": routeAiAgentSandbox.module.exports,
});
const sandbox = loadTsModule("lib/jobMatching.ts", {
  "./routeAiAgent": routeAiAgentSandbox.module.exports,
  "./profitability": profitabilitySandbox.module.exports,
  "./routeQuotes": routeQuotesSandbox.module.exports,
});
const matching = sandbox.module.exports;
const timingSandbox = loadTsModule("lib/jobTiming.ts");
const timing = timingSandbox.module.exports;

assert.equal(matching.isJobMatchingEnabled(), false);
sharedProcess.env.EXPO_PUBLIC_ENABLE_JOB_MATCHING = "true";
assert.equal(matching.isJobMatchingEnabled(), true);
sharedProcess.env.EXPO_PUBLIC_ENABLE_JOB_MATCHING = "";
expoConstants.default.expoConfig.extra.ENABLE_JOB_MATCHING = true;
assert.equal(matching.isJobMatchingEnabled(), true);

assert.equal(matching.getJobMatchingTaskDurationMinutes(), null);
sharedProcess.env.EXPO_PUBLIC_JOB_MATCHING_TASK_DURATION_MINUTES = "75";
assert.equal(matching.getJobMatchingTaskDurationMinutes(), 75);

assert.equal(matching.recommendationLabel("accept"), "Accept");
assert.equal(matching.recommendationLabel("borderline"), "Borderline");
assert.equal(matching.recommendationLabel("reject"), "Reject");
assert.equal(matching.recommendationLabel("unavailable"), "Unavailable");
assert.equal(
  matching.recommendationTier({
    status: "available",
    recommendation: "accept",
  }),
  "Highly Recommended"
);
assert.equal(
  matching.recommendationTier({
    status: "partial",
    recommendation: "accept",
  }),
  "Recommended"
);
assert.equal(
  matching.recommendationTier({
    status: "available",
    recommendation: "borderline",
  }),
  "Worth Considering"
);
assert.equal(
  matching.recommendationTier({
    status: "available",
    recommendation: "reject",
  }),
  "Low Value"
);
assert.equal(
  matching.recommendationTier({
    status: "unavailable",
    recommendation: "unavailable",
  }),
  "Unavailable"
);
assert.equal(matching.modeLabel("bicycle"), "Bicycle");
assert.equal(matching.formatMatchScore(87.654), "87.7");
assert.equal(
  matching.formatMatchHourlyRate({
    profitability: { effective_hourly_rate_pence: 1420 },
  }),
  "\u00A314.20/hr"
);
assert.equal(
  matching.formatMatchTravelTime({
    profitability: { outbound_travel_seconds: 1080 },
  }),
  "18 min"
);

const originalJobs = [{ id: "job-a" }, { id: "job-b" }, { id: "job-c" }];
assert.equal(
  JSON.stringify(matching.orderJobsByMatch(originalJobs, {}).map((job) => job.id)),
  JSON.stringify(["job-a", "job-b", "job-c"])
);
assert.equal(
  JSON.stringify(
    matching
      .orderJobsByMatch(originalJobs, {
        "job-b": { job_id: "job-b", rank: 1 },
        "job-a": { job_id: "job-a", rank: 2 },
      })
      .map((job) => job.id)
  ),
  JSON.stringify(["job-b", "job-a", "job-c"])
);

assert.equal(
  matching.formatMatchProfitabilitySummary({
    profitability: {
      outbound_travel_seconds: 1080,
      travel_cost_pence: 250,
      net_earnings_pence: 1750,
      effective_hourly_rate_pence: 1420,
    },
  }),
  "Travel 18 min · Cost \u00A32.50 · Net \u00A317.50 · Rate \u00A314.20/hr"
);
assert.equal(
  matching.formatMatchProfitabilitySummary({
    status: "partial",
    profitability: {
      outbound_travel_seconds: 1080,
      travel_cost_pence: null,
      net_earnings_pence: null,
      effective_hourly_rate_pence: null,
    },
  }),
  "Travel 18 min · Cost Unavailable · Net Unavailable · Rate Unavailable"
);
assert.equal(
  matching.formatMatchProfitabilitySummary({
    status: "unavailable",
    profitability: null,
  }),
  "Profitability unavailable"
);

const needNowTiming = timing.getJobRouteTiming({ urgency: "Need now" }, new Date("2026-06-20T09:07:00Z"));
assert.equal(needNowTiming.kind, "provisional");
assert.equal(needNowTiming.startsAt, "2026-06-20T09:15:00.000Z");
assert.equal(needNowTiming.label, "Estimated before start time is agreed.");
assert.equal(needNowTiming.shortLabel, "Estimated timing");

const flexibleTiming = timing.getJobRouteTiming({ urgency: "Flexible" }, new Date("2026-06-20T09:07:00"));
const flexibleStartsAt = new Date(flexibleTiming.startsAt);
assert.equal(flexibleTiming.kind, "provisional");
assert.equal(flexibleStartsAt.getDate(), 21);
assert.equal(flexibleStartsAt.getHours(), 10);
assert.equal(flexibleStartsAt.getMinutes(), 0);

const confirmedTiming = timing.getJobRouteTiming(
  { urgency: "Need now", agreed_start_at: "2026-06-20T17:00:00Z" },
  new Date("2026-06-20T09:07:00Z")
);
assert.equal(confirmedTiming.kind, "confirmed");
assert.equal(confirmedTiming.startsAt, "2026-06-20T17:00:00.000Z");
assert.equal(confirmedTiming.label, "Based on agreed start time.");
assert.equal(confirmedTiming.shortLabel, "Confirmed route estimate");

const preferredTiming = timing.getJobRouteTiming(
  { urgency: "Flexible", preferred_start_at: "2026-06-21T11:30:00Z" },
  new Date("2026-06-20T09:07:00Z")
);
assert.equal(preferredTiming.kind, "provisional");
assert.equal(preferredTiming.startsAt, "2026-06-21T11:30:00.000Z");
assert.equal(timing.matchingTimingNotice(true), "Best jobs are estimated using provisional times until a start time is agreed.");
assert.equal(timing.matchingTimingNotice(false), null);

const stableRequestKey = matching.buildJobMatchRequestKey({
  jobId: "job-a",
  origin: { latitude: 53.5, longitude: -1.1 },
  destination: { latitude: 53.6, longitude: -1.2 },
  timingKind: needNowTiming.kind,
  startsAt: needNowTiming.startsAt,
  pricePence: 2000,
  taskDurationMinutes: 60,
});
assert.equal(
  stableRequestKey,
  matching.buildJobMatchRequestKey({
    jobId: "job-a",
    origin: { latitude: 53.5, longitude: -1.1 },
    destination: { latitude: 53.6, longitude: -1.2 },
    timingKind: needNowTiming.kind,
    startsAt: needNowTiming.startsAt,
    pricePence: 2000,
    taskDurationMinutes: 60,
  })
);
assert.notEqual(
  stableRequestKey,
  matching.buildJobMatchRequestKey({
    jobId: "job-b",
    origin: { latitude: 53.5, longitude: -1.1 },
    destination: { latitude: 53.6, longitude: -1.2 },
    timingKind: needNowTiming.kind,
    startsAt: needNowTiming.startsAt,
    pricePence: 2000,
    taskDurationMinutes: 60,
  })
);
assert.notEqual(
  stableRequestKey,
  matching.buildJobMatchRequestKey({
    jobId: "job-a",
    origin: { latitude: 53.5, longitude: -1.1 },
    destination: { latitude: 53.7, longitude: -1.2 },
    timingKind: needNowTiming.kind,
    startsAt: needNowTiming.startsAt,
    pricePence: 2000,
    taskDurationMinutes: 60,
  })
);

let capturedRequest = null;
sharedProcess.env.EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL = "http://localhost:8000";
sandbox.fetch = async (url, options) => {
  capturedRequest = { url, options };
  return {
    ok: true,
    json: async () => ({
      status: "available",
      ranked_jobs: [
        {
          rank: 1,
          job_id: "job-b",
          status: "available",
          recommendation: "accept",
          best_mode: "bus",
          score: 88.2,
          reason: "job-b ranked with bus: good earnings.",
        },
      ],
    }),
  };
};

const response = await matching.fetchJobMatches(
  { latitude: 53.5, longitude: -1.1 },
  [
    {
      jobId: "job-a",
      pricePence: 2000,
      taskDurationMinutes: 60,
      location: { latitude: 53.6, longitude: -1.2 },
      startsAt: needNowTiming.startsAt,
    },
  ]
);

assert.equal(response.ranked_jobs[0].job_id, "job-b");
assert.equal(capturedRequest.url, "http://localhost:8000/v1/jobs/match");
const body = JSON.parse(capturedRequest.options.body);
assert.equal(JSON.stringify(body.travel.modes), JSON.stringify(["walk", "bicycle", "car", "bus"]));
assert.equal(body.travel.return_journey, false);
assert.equal(body.jobs[0].job_id, "job-a");
assert.equal(body.jobs[0].starts_at, needNowTiming.startsAt);

const matchingRequests = [];
sandbox.fetch = async (url, options) => {
  const requestBody = JSON.parse(options.body);
  matchingRequests.push(requestBody.travel.modes);
  if (requestBody.travel.modes.includes("bus")) {
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
      status: "available",
      ranked_jobs: [
        {
          rank: 1,
          job_id: "job-a",
          status: "available",
          recommendation: "accept",
          best_mode: "walk",
          score: 71,
          reason: "job-a ranked without unavailable bus timetable.",
        },
      ],
    }),
  };
};
const fallbackMatch = await matching.fetchJobMatches(
  { latitude: 53.5, longitude: -1.1 },
  [
    {
      jobId: "job-a",
      pricePence: 2000,
      taskDurationMinutes: 60,
      location: { latitude: 53.6, longitude: -1.2 },
      startsAt: needNowTiming.startsAt,
    },
  ]
);
assert.deepEqual(matchingRequests, [["walk", "bicycle", "car", "bus"], ["walk", "bicycle", "car"]]);
assert.equal(fallbackMatch.ranked_jobs[0].best_mode, "walk");

sandbox.fetch = async () => ({
  ok: false,
  status: 503,
  json: async () => ({}),
});
await assert.rejects(
  () =>
    matching.fetchJobMatches(
      { latitude: 53.5, longitude: -1.1 },
      [
        {
          jobId: "job-a",
          pricePence: 2000,
          taskDurationMinutes: 60,
          location: { latitude: 53.6, longitude: -1.2 },
          startsAt: "2026-06-20T17:00:00Z",
        },
      ]
    ),
  /status 503/
);

console.log("job matching tests passed");
