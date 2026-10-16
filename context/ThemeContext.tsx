import { AppColors, AppPalette } from "@/constants/theme";
import {
  DEFAULT_READER_PREFS,
  READER_FONT_SIZES,
  ReaderPrefs,
} from "@/constants/ReaderThemes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";

export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

const THEME_PREF_KEY = "@vellum_theme_pref";
const READER_PREFS_KEY = "@vellum_reader_prefs";

type ThemeContextType = {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  /** Flip between light and dark (leaves "system" mode). */
  toggleScheme: () => void;
  scheme: ColorScheme;
  colors: AppPalette;
  readerPrefs: ReaderPrefs;
  updateReaderPrefs: (patch: Partial<ReaderPrefs>) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  preference: "system",
  setPreference: () => {},
  toggleScheme: () => {},
  scheme: "dark",
  colors: AppColors.dark,
  readerPrefs: DEFAULT_READER_PREFS,
  updateReaderPrefs: () => {},
});

// Keeps native UI (alerts, keyboards, pickers) in step with the app's mode.
// null hands control back to the device setting.
const applyNativeScheme = (pref: ThemePreference) => {
  try {
    Appearance.setColorScheme(pref === "system" ? null : pref);
  } catch {}
};

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [readerPrefs, setReaderPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);

  useEffect(() => {
    (async () => {
      try {
        const [pref, reader] = await Promise.all([
          AsyncStorage.getItem(THEME_PREF_KEY),
          AsyncStorage.getItem(READER_PREFS_KEY),
        ]);
        if (pref === "light" || pref === "dark") {
          applyNativeScheme(pref);
          setPreferenceState(pref);
        }
        if (reader) {
          const parsed = { ...DEFAULT_READER_PREFS, ...JSON.parse(reader) };
          if (!READER_FONT_SIZES.includes(parsed.fontSize)) {
            parsed.fontSize = DEFAULT_READER_PREFS.fontSize;
          }
          setReaderPrefs(parsed);
        }
      } catch {}
    })();
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    applyNativeScheme(pref);
    setPreferenceState(pref);
    AsyncStorage.setItem(THEME_PREF_KEY, pref).catch(() => {});
  }, []);

  // While following the device, read the live value: useColorScheme() can lag
  // a render behind after leaving a forced mode. An explicit choice always wins.
  const deviceScheme = Appearance.getColorScheme() ?? systemScheme;
  const scheme: ColorScheme =
    preference === "system" ? (deviceScheme === "light" ? "light" : "dark") : preference;

  const toggleScheme = useCallback(() => {
    setPreference(scheme === "dark" ? "light" : "dark");
  }, [scheme, setPreference]);

  const updateReaderPrefs = useCallback((patch: Partial<ReaderPrefs>) => {
    setReaderPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(READER_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      toggleScheme,
      scheme,
      colors: AppColors[scheme],
      readerPrefs,
      updateReaderPrefs,
    }),
    [preference, setPreference, toggleScheme, scheme, readerPrefs, updateReaderPrefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);

/**
 * Builds styles from the active palette. Pass a module-level factory that
 * returns `StyleSheet.create(...)`, so styles are only rebuilt when the theme
 * changes.
 */
export function useThemedStyles<T>(factory: (c: AppPalette) => T): T {
  const { colors } = useAppTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
