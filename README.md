# Expo Router Example

Use [`expo-router`](https://docs.expo.dev/router/introduction/) to build native navigation using files in the `app/` directory.

## Launch your own

[![Launch with Expo](https://github.com/expo/examples/blob/master/.gh-assets/launch.svg?raw=true)](https://launch.expo.dev/?github=https://github.com/expo/examples/tree/master/with-router)

## 🚀 How to use

```sh
npx create-expo-app -e with-router
```

## Deploy

Deploy on all platforms with Expo Application Services (EAS).

- Deploy the website: `npx eas-cli deploy` — [Learn more](https://docs.expo.dev/eas/hosting/get-started/)
- Deploy on iOS and Android using: `npx eas-cli build` — [Learn more](https://expo.dev/eas)

## 📝 Notes

- [Expo Router: Docs](https://docs.expo.dev/router/introduction/)
# fen-mvp

## Route quotes

Route quote display is disabled unless explicitly enabled:

```sh
ENABLE_ROUTE_QUOTES=true
ROUTE_AI_AGENT_BASE_URL=http://localhost:8000
```

Expo public env names are also supported:

```sh
EXPO_PUBLIC_ENABLE_ROUTE_QUOTES=true
EXPO_PUBLIC_ROUTE_AI_AGENT_BASE_URL=http://localhost:8000
```

The job detail screen requests only `walk`, `bicycle`, `car`, and `bus` from route-ai-agent. Train and combined public transport modes are intentionally not shown in this MVP surface.
