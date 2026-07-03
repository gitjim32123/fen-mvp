const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.24,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

export const darkTheme = {
  colors: {
    bg: "#1E1A24",
    bgDeep: "#17131C",
    surface: "#29242F",
    surfaceAlt: "#332E3A",
    surfaceRaised: "#3D3747",
    border: "rgba(255, 255, 255, 0.10)",
    borderStrong: "rgba(255, 255, 255, 0.18)",
    text: "#F4EFF8",
    muted: "#D0C7D8",
    subtle: "#B6ACBF",
    placeholder: "#9C92A6",
    accent: "#B082EA",
    accentSoft: "rgba(176, 130, 234, 0.15)",
    accentText: "#18121F",
    focus: "#C39AF2",
    disabled: "#655D70",
    textInverse: "#18121F",
    overlay: "rgba(17, 14, 22, 0.70)",
    overlaySoft: "rgba(37, 32, 44, 0.9)",
    success: "#66D19E",
    successBg: "#172C23",
    successText: "#D7F5DE",
    warning: "#E7AC55",
    warningBg: "#322718",
    warningText: "#FFE7C1",
    danger: "#FF8FA3",
    dangerBg: "#331D24",
    dangerText: "#FFD8DE",
    info: "#91B7F4",
    infoBg: "#20293A",
    infoText: "#D6E3FF",
    chipBg: "#302B37",
    chipActiveBg: "rgba(176, 130, 234, 0.18)",
    inputBg: "#2C2733",
    mapBg: "#25212A",
    mapLand: "#302B35",
    mapRoad: "rgba(244, 239, 248, 0.18)",
    mapWater: "rgba(126, 190, 225, 0.22)",
  },
  spacing,
  radius,
  shadow,
};

export const lightTheme: typeof darkTheme = {
  colors: {
    bg: "#F7F2EC",
    bgDeep: "#EFE7DD",
    surface: "#FFFDF9",
    surfaceAlt: "#F2ECE4",
    surfaceRaised: "#FFFFFF",
    border: "#E1D8CC",
    borderStrong: "#CBBFB1",
    text: "#262229",
    muted: "#635C68",
    subtle: "#817780",
    placeholder: "#9A9097",
    accent: "#7650BC",
    accentSoft: "#EEE7F7",
    accentText: "#FFFFFF",
    focus: "#7650BC",
    disabled: "#D4CBC1",
    textInverse: "#FFFFFF",
    overlay: "rgba(39, 36, 42, 0.46)",
    overlaySoft: "rgba(255, 253, 249, 0.94)",
    success: "#2E7D53",
    successBg: "#E7F3EC",
    successText: "#1E5237",
    warning: "#9D6517",
    warningBg: "#FFF0D7",
    warningText: "#6E4308",
    danger: "#B54A5E",
    dangerBg: "#FCE8EC",
    dangerText: "#7D2436",
    info: "#426CA7",
    infoBg: "#E8EEF8",
    infoText: "#2F4D78",
    chipBg: "#FFFDF9",
    chipActiveBg: "#EEE7F7",
    inputBg: "#FFFDF9",
    mapBg: "#F0E8DD",
    mapLand: "#FFFDF9",
    mapRoad: "rgba(99, 92, 104, 0.24)",
    mapWater: "rgba(66, 108, 167, 0.18)",
  },
  spacing,
  radius,
  shadow: {
    ...shadow,
    shadowOpacity: 0.12,
  },
};

export type Theme = typeof darkTheme;
export type ThemeMode = "dark" | "light";

export function getTheme(mode: ThemeMode): Theme {
  return mode === "light" ? lightTheme : darkTheme;
}

export const theme = darkTheme;
