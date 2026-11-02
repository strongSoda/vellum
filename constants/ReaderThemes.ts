import { Platform } from "react-native";

// ── Page themes ──────────────────────────────────────────────────────────────
// Colors for the book page and the reader's own header/footer, so the whole
// reading screen matches the chosen page.
export type ReaderThemeId = "auto" | "paper" | "sepia" | "sage" | "dusk" | "night";

export type ReaderTheme = {
  id: Exclude<ReaderThemeId, "auto">;
  label: string;
  dark: boolean;
  background: string;
  text: string;
  muted: string;
  chrome: string; // header / footer / sheets
  border: string;
  link: string;
};

export const READER_THEMES: ReaderTheme[] = [
  {
    id: "paper",
    label: "Paper",
    dark: false,
    background: "#FFFFFF",
    text: "#1F1F1F",
    muted: "#777777",
    chrome: "#F5F5F3",
    border: "#E4E4E0",
    link: "#0B8A5A",
  },
  {
    id: "sepia",
    label: "Sepia",
    dark: false,
    background: "#F4ECD8",
    text: "#5B4636",
    muted: "#8C7660",
    chrome: "#EADFC6",
    border: "#D9CBAE",
    link: "#8A5A1E",
  },
  {
    id: "sage",
    label: "Sage",
    dark: false,
    background: "#E3EDDF",
    text: "#2F3B2D",
    muted: "#62715E",
    chrome: "#D6E3D1",
    border: "#BFD0B9",
    link: "#2E6B3A",
  },
  {
    id: "dusk",
    label: "Dusk",
    dark: true,
    background: "#2B2F36",
    text: "#D5D9E0",
    muted: "#8C939E",
    chrome: "#23272D",
    border: "#3A3F47",
    link: "#7FD6B0",
  },
  {
    id: "night",
    label: "Night",
    dark: true,
    background: "#050505",
    text: "#CCCCCC",
    muted: "#888888",
    chrome: "#111111",
    border: "#222222",
    link: "#2DDA93",
  },
];

/** "auto" follows the app's light/dark mode. */
export const resolveReaderTheme = (
  id: ReaderThemeId,
  appScheme: "light" | "dark",
): ReaderTheme => {
  const resolvedId = id === "auto" ? (appScheme === "dark" ? "night" : "paper") : id;
  return READER_THEMES.find((t) => t.id === resolvedId) ?? READER_THEMES[0];
};

// ── Fonts ────────────────────────────────────────────────────────────────────
// Only fonts that ship with the OS, so books stay fully offline. `css` is the
// stack used inside the book WebView (double quotes only — the epub library
// wraps it in single quotes); `preview` is the React Native fontFamily used
// to render the option's label.
export type ReaderFont = { id: string; label: string; css: string; preview?: string };

const IOS_FONTS: ReaderFont[] = [
  { id: "georgia", label: "Georgia", css: "Georgia, serif", preview: "Georgia" },
  { id: "palatino", label: "Palatino", css: 'Palatino, "Palatino Linotype", serif', preview: "Palatino" },
  { id: "iowan", label: "Iowan", css: '"Iowan Old Style", serif', preview: "Iowan Old Style" },
  { id: "charter", label: "Charter", css: "Charter, serif", preview: "Charter" },
  { id: "baskerville", label: "Baskerville", css: "Baskerville, serif", preview: "Baskerville" },
  { id: "times", label: "Times", css: '"Times New Roman", Times, serif', preview: "Times New Roman" },
  { id: "avenir", label: "Avenir", css: '"Avenir Next", Avenir, sans-serif', preview: "Avenir Next" },
  { id: "helvetica", label: "Helvetica", css: '"Helvetica Neue", Helvetica, sans-serif', preview: "Helvetica Neue" },
  { id: "system", label: "System", css: "-apple-system, system-ui, sans-serif" },
  { id: "typewriter", label: "Typewriter", css: '"American Typewriter", "Courier New", monospace', preview: "American Typewriter" },
  { id: "mono", label: "Menlo", css: "Menlo, monospace", preview: "Menlo" },
];

const ANDROID_FONTS: ReaderFont[] = [
  { id: "georgia", label: "Serif", css: "Georgia, serif", preview: "serif" },
  { id: "system", label: "Sans", css: "sans-serif", preview: "sans-serif" },
  { id: "light", label: "Light", css: '"sans-serif-light", sans-serif', preview: "sans-serif-light" },
  { id: "medium", label: "Medium", css: '"sans-serif-medium", sans-serif', preview: "sans-serif-medium" },
  { id: "condensed", label: "Condensed", css: '"sans-serif-condensed", sans-serif', preview: "sans-serif-condensed" },
  { id: "typewriter", label: "Typewriter", css: '"serif-monospace", monospace', preview: "serif-monospace" },
  { id: "mono", label: "Mono", css: "monospace", preview: "monospace" },
  { id: "casual", label: "Casual", css: "casual, cursive", preview: "casual" },
  { id: "cursive", label: "Cursive", css: "cursive", preview: "cursive" },
];

export const READER_FONTS: ReaderFont[] = Platform.OS === "ios" ? IOS_FONTS : ANDROID_FONTS;

export const resolveReaderFont = (id: string): ReaderFont =>
  READER_FONTS.find((f) => f.id === id) ?? READER_FONTS[0];

// ── Font sizes (percent of the book's base size) ─────────────────────────────
export const READER_FONT_SIZES = [80, 90, 100, 110, 120, 135, 150, 175];

// ── Page margins (extra side space, in px, on top of the book's own) ─────────
export const READER_MARGINS = [
  { value: 0, label: "None" },
  { value: 16, label: "Small" },
  { value: 32, label: "Medium" },
  { value: 52, label: "Large" },
];

// ── Line spacing (CSS line-height) ───────────────────────────────────────────
export const READER_LINE_HEIGHTS = [
  { value: 1.2, label: "Tight" },
  { value: 1.4, label: "Snug" },
  { value: 1.6, label: "Normal" },
  { value: 1.8, label: "Relaxed" },
  { value: 2.0, label: "Loose" },
];

// ── Page flow: turn pages, or scroll the book like a web page ────────────────
export type ReaderFlow = "paginated" | "scrolled";
export const READER_FLOWS: { value: ReaderFlow; label: string }[] = [
  { value: "paginated", label: "Pages" },
  { value: "scrolled", label: "Scroll" },
];

// ── Highlighter colors ───────────────────────────────────────────────────────
export const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Yellow", color: "#FFD60A" },
  { id: "green", label: "Green", color: "#4ADE80" },
  { id: "blue", label: "Blue", color: "#60A5FA" },
  { id: "pink", label: "Pink", color: "#F472B6" },
  { id: "orange", label: "Orange", color: "#FB923C" },
];
export const HIGHLIGHT_OPACITY = 0.35;

export type ReaderPrefs = {
  theme: ReaderThemeId;
  font: string; // ReaderFont id
  fontSize: number; // one of READER_FONT_SIZES
  margin: number; // one of READER_MARGINS values
  lineHeight: number; // one of READER_LINE_HEIGHTS values
  flow: ReaderFlow;
};

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  theme: "auto",
  font: "georgia",
  fontSize: 100,
  margin: 0,
  lineHeight: 1.6,
  flow: "paginated",
};

/** Stylesheet handed to epub.js for the book's pages. */
export const buildEpubTheme = (
  theme: ReaderTheme,
  font: ReaderFont,
  lineHeight: number = DEFAULT_READER_PREFS.lineHeight,
) => ({
  body: {
    background: `${theme.background} !important`,
    color: `${theme.text} !important`,
    "font-family": `${font.css} !important`,
    "line-height": `${lineHeight} !important`,
  },
  "p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, dt, dd, em, strong, i, b, small, cite": {
    color: "inherit !important",
    "background-color": "transparent !important",
  },
  "p, div, li, blockquote, td, dd": {
    "font-family": "inherit !important",
    "line-height": `${lineHeight} !important`,
  },
  "a, a:link, a:visited": {
    color: `${theme.link} !important`,
  },
});
