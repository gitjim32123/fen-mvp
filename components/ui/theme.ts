const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
};

const radius = {
  sm: 10,
  md: 14,
  lg: 18,
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
    bg: "#0E0A14",
    bgDeep: "#090611",
    surface: "#171024",
    surfaceAlt: "#20172E",
    surfaceRaised: "#211730",
    border: "#231A33",
    borderStrong: "#5B3A87",
    text: "#E7D9FF",
    muted: "#CBB8F1",
    subtle: "#A590C9",
    placeholder: "#8D79AF",
    accent: "#B56CFF",
    accentSoft: "#2A1E3D",
    accentText: "#140E1D",
    focus: "#B56CFF",
    disabled: "#4A3A63",
    textInverse: "#140E1D",
    overlay: "rgba(0,0,0,0.7)",
    overlaySoft: "rgba(14, 10, 20, 0.92)",
    success: "#66D19E",
    successBg: "#12251D",
    successText: "#D7F5DE",
    warning: "#FFB347",
    warningBg: "#2B1E0A",
    warningText: "#FFE0B8",
    danger: "#FF8FA3",
    dangerBg: "#2B161B",
    dangerText: "#FFD8DE",
    info: "#8FB7FF",
    infoBg: "#182033",
    infoText: "#D6E3FF",
    chipBg: "#171024",
    chipActiveBg: "#2A1E3D",
    inputBg: "#171024",
    mapBg: "#100B18",
    mapLand: "#171024",
    mapRoad: "rgba(231, 217, 255, 0.14)",
    mapWater: "rgba(92, 207, 255, 0.2)",
  },
  spacing,
  radius,
  shadow,
};

export const lightTheme: typeof darkTheme = {
  colors: {
    bg: "#F8F5FF",
    bgDeep: "#EFE8FA",
    surface: "#FFFFFF",
    surfaceAlt: "#F1EAFB",
    surfaceRaised: "#FFFFFF",
    border: "#DED2EF",
    borderStrong: "#B999E2",
    text: "#241633",
    muted: "#59456F",
    subtle: "#77648D",
    placeholder: "#8A789C",
    accent: "#8A3FDB",
    accentSoft: "#EFE2FF",
    accentText: "#FFFFFF",
    focus: "#8A3FDB",
    disabled: "#C9BDD9",
    textInverse: "#FFFFFF",
    overlay: "rgba(20,14,29,0.52)",
    overlaySoft: "rgba(248, 245, 255, 0.92)",
    success: "#247A4A",
    successBg: "#E7F6ED",
    successText: "#174D31",
    warning: "#A85F00",
    warningBg: "#FFF2DA",
    warningText: "#6F3E00",
    danger: "#B73D56",
    dangerBg: "#FFE9EE",
    dangerText: "#7A1E31",
    info: "#3268C6",
    infoBg: "#EAF1FF",
    infoText: "#244B8F",
    chipBg: "#FFFFFF",
    chipActiveBg: "#EFE2FF",
    inputBg: "#FFFFFF",
    mapBg: "#F4EEFC",
    mapLand: "#FFFFFF",
    mapRoad: "rgba(89, 69, 111, 0.2)",
    mapWater: "rgba(50, 104, 198, 0.16)",
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
