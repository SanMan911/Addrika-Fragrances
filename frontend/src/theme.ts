// Design tokens for Aarohmm Pad. Light theme only.
// Keys match the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F9F8F6",
  onSurface: "#1C1B1A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1B1A",
  surfaceTertiary: "#F2EFEA",
  onSurfaceTertiary: "#4A4846",
  surfaceInverse: "#2A2D2A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#73706C",

  brand: "#4F6354",
  onBrand: "#FFFFFF",
  brandPrimary: "#4F6354",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B88E75",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E3E8E4",
  onBrandTertiary: "#3A4A3E",

  success: "#3E7B5B",
  onSuccess: "#FFFFFF",
  warning: "#D99C41",
  onWarning: "#FFFFFF",
  error: "#C2544A",
  onError: "#FFFFFF",
  info: "#6B6965",
  onInfo: "#FFFFFF",

  border: "#E6E3DE",
  borderStrong: "#C9C5BE",
  divider: "#E6E3DE",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
