# FEN MVP

FEN is an Expo Router app for local one-off jobs. Workers can browse jobs, apply, message selected posters, and view route/profitability recommendations backed by the separate `route-ai-agent` API.

## Stack

- Expo SDK 54 with Expo Router
- React Native / React Native Web
- Supabase Auth, Postgres, Realtime-compatible tables, and Storage
- route-ai-agent for route quotes, profitability, and job matching

## Setup

Install dependencies:

```sh
npm install
```

Create a local `.env` from `.env.example` and fill in the project-specific public Supabase values:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL=http://localhost:8000
EXPO_PUBLIC_ENABLE_ROUTE_QUOTES=true
EXPO_PUBLIC_ENABLE_PROFITABILITY=true
EXPO_PUBLIC_ENABLE_JOB_MATCHING=true
EXPO_PUBLIC_PROFITABILITY_TASK_DURATION_MINUTES=60
EXPO_PUBLIC_JOB_MATCHING_TASK_DURATION_MINUTES=60
```

`.env` is intentionally ignored. Do not commit local secrets or production-only configuration.

## Run

```sh
npm run web
```

Other Expo targets:

```sh
npm run android
npm run ios
npm start
```

## Route AI Integration

The app talks to `route-ai-agent` through `EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL`.

Current FEN UI surfaces only:

- Walk
- Bicycle
- Car
- Bus

Train and combined public transport modes are intentionally not exposed in this MVP UI.

Route quotes and profitability are shown on job detail when enabled. Job matching is shown on the worker browse list when enabled. Matching uses provisional timing for jobs without an agreed start time:

- `Need now`: current time rounded up to the next 15 minutes
- `Flexible`: a sensible future default from the app timing helper
- Confirmed jobs: the agreed start time

Provisional results are labelled as estimated until a start time is agreed.

Bus/public-transport results depend on the local `route-ai-agent` OpenTripPlanner graph having current GTFS timetable data. If GTFS is missing or outside its service period, OTP may return `OUTSIDE_SERVICE_PERIOD`; FEN treats that as an unavailable bus mode, keeps walk/bicycle/car results eligible, and does not show raw OTP text to normal users.

## Supabase

Schema and RLS artifacts live in `supabase/`.

Do not apply migrations directly to production without review. The current artifact set documents:

- active tables
- indexes
- RLS policies
- `job-photos` Storage bucket
- worker completion helper RPC
- reopened-job application reset helper RPC

`profiles.strike_count` is not part of the active app schema.

## Tests And Checks

```sh
npm run typecheck
npm run test:route-quotes
npm run test:profitability
npm run test:job-matching
npm test
npx --no-install expo config --type public
npx --no-install expo-doctor
```

`expo-doctor` may require working local TLS trust for checks that call Expo or React Native Directory services.

## Known Limitations

- No train or combined public-transport UI in FEN yet.
- No automatic accept/apply decisions are made inside FEN.
- FEN does not calculate route costs, profitability, or matching scores locally.
- Job photo upload requires the `job-photos` bucket, `job_photos` table, and policies to be deployed.
- Worker completion and reopened-application reset require the lifecycle helper RPC migration to be deployed.
- Production route-ai-agent URLs must be configured per environment; `localhost:8000` is local development only.
