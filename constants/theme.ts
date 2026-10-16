/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// ── Vellum app palettes ─────────────────────────────────────────────────────
export type AppPalette = {
  background: string;
  surface: string; // cards, panels
  surfaceAlt: string; // inputs, chips, segmented controls
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accent: string; // fills (buttons, banners) — always paired with onAccent
  accentText: string; // accent used as text/icon color on background
  accentSoft: string;
  onAccent: string;
  inverse: string; // high-contrast button fill (e.g. READ BOOK)
  onInverse: string;
  overlay: string;
  shadow: string;
};

export const AppColors: Record<'light' | 'dark', AppPalette> = {
  dark: {
    background: '#050505',
    surface: '#111111',
    surfaceAlt: '#1A1A1A',
    border: '#222222',
    borderStrong: '#333333',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#888888',
    textFaint: '#555555',
    accent: '#2DDA93',
    accentText: '#2DDA93',
    accentSoft: 'rgba(45, 218, 147, 0.12)',
    onAccent: '#000000',
    inverse: '#FFFFFF',
    onInverse: '#000000',
    overlay: 'rgba(0, 0, 0, 0.75)',
    shadow: '#000000',
  },
  light: {
    background: '#F6F5F1',
    surface: '#FFFFFF',
    surfaceAlt: '#ECEBE6',
    border: '#E2E0D9',
    borderStrong: '#CCC9C0',
    text: '#141414',
    textSecondary: '#3A3A3A',
    textMuted: '#6B6B6B',
    textFaint: '#9C9A94',
    accent: '#2DDA93',
    accentText: '#0B8A5A',
    accentSoft: 'rgba(11, 138, 90, 0.10)',
    onAccent: '#000000',
    inverse: '#141414',
    onInverse: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.4)',
    shadow: '#7A7464',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
