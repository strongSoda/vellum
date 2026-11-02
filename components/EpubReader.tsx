import { ReaderProvider, useReader } from "@epubjs-react-native/core";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  buildEpubTheme,
  HIGHLIGHT_OPACITY,
  READER_FONT_SIZES,
  READER_FLOWS,
  READER_FONTS,
  READER_LINE_HEIGHTS,
  READER_MARGINS,
  READER_THEMES,
  ReaderFont,
  ReaderPrefs,
  ReaderTheme,
  resolveReaderFont,
  resolveReaderTheme,
} from "@/constants/ReaderThemes";
import { Snippet, useLibrary } from "@/context/LibraryContext";
import { useAppTheme } from "@/context/ThemeContext";
import * as FileSystem from "expo-file-system/legacy";
import { useLegacyFileSystem } from "@/hooks/useLegacyFileSystem";
import { downloadDictionary, getLocalDefinition } from "@/utils/Dictionary";
import { isImportedBook } from "@/utils/LocalBooks";
import { MemoizedReader } from "./MemoReader";
import { ReaderPopup } from "./ReaderPopup";

const LARGE_SCREEN_THRESHOLD = 768;

// Minimum time (ms) between page-turn and allowing a new selection popup.
// Prevents swipe gestures from accidentally triggering word lookups.
const SELECTION_DEBOUNCE_MS = 400;

// How long a book may take to open before we offer alternatives.
const OPEN_TIMEOUT_MS = 25000;

// Space kept above and below the text on top of the chosen page margin, so
// lines never touch the header, footer or screen edge.
const PAGE_VERTICAL_INSET = 12;

// Reopens the book at the saved place. A plain rendition.display(cfi) can be
// undone: any resize of the reader while it's loading makes epub.js re-show
// the page it was on (page one). So keep re-asserting the jump until it has
// landed, for a few seconds at most, or until the reader navigates themselves.
const restoreLocationJs = (cfi: string) => `
(function () {
  try {
    var target = ${JSON.stringify(cfi)};
    var deadline = Date.now() + 6000;
    var cfiTool = new ePub.CFI();
    function landed(loc) {
      try {
        return cfiTool.compare(loc.start.cfi, target) <= 0 &&
          cfiTool.compare(loc.end.cfi, target) >= 0;
      } catch (e) { return true; }
    }
    function stop() {
      rendition.off('relocated', onRelocated);
      window.__vellumCancelRestore = null;
    }
    function onRelocated(loc) {
      if (Date.now() > deadline || landed(loc)) return stop();
      rendition.display(target);
    }
    window.__vellumCancelRestore = stop;
    rendition.on('relocated', onRelocated);
    rendition.display(target);
  } catch (e) {}
})();
true;
`;

// Run before any navigation the reader asks for, so the restore above
// doesn't pull them back.
const CANCEL_RESTORE_JS = `window.__vellumCancelRestore && window.__vellumCancelRestore(); true;`;

// Jumps to a table-of-contents entry. TOC hrefs are relative to the book's
// nav file, which isn't always next to the chapters, so a plain
// rendition.display(href) silently finds no section in many books. Match the
// spine item by file name when the direct lookup fails.
const goToHrefJs = (href: string) => `
(function () {
  try {
    window.__vellumCancelRestore && window.__vellumCancelRestore();
    var href = ${JSON.stringify(href)};
    var parts = href.split('#');
    var path = parts[0], hash = parts[1];
    var section = path ? book.spine.get(path) : null;
    if (!section && path) {
      var name = decodeURIComponent(path.split('/').pop());
      book.spine.each(function (item) {
        if (!section && decodeURIComponent(item.href.split('/').pop()) === name) section = item;
      });
    }
    var target = section ? section.href + (hash ? '#' + hash : '') : href;
    rendition.display(target).catch(function () {
      if (section) rendition.display(section.href);
    });
  } catch (e) {}
})();
true;
`;

// ─── Types ───────────────────────────────────────────────────────────────────
type TocItem = {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
};
type PageInfo = { page: number; total: number };

// ─── ReaderEngine ────────────────────────────────────────────────────────────
// Lives inside ReaderProvider — bridges useReader() hooks with parent state.
const ReaderEngine = ({
  epubUri,
  fs,
  initialLocation,
  handleSelection,
  handleExternalLink,
  readerTheme,
  readerFont,
  fontSize,
  lineHeight,
  flow,
  bookId,
  highlights,
  readerApiRef,
  onBookOpened,
  onOpenError,
  onPressHighlight,
  setProgress,
  setSectionLabel,
  setPageInfo,
  onBookFinished,
  setTocData,
  toggleUI,
  onPageChanged,
}: any) => {
  const { updateLocation } = useLibrary();
  const {
    changeTheme,
    changeFontFamily,
    changeFontSize,
    addAnnotation,
    removeAnnotationByCfi,
    injectJavascript,
    currentLocation,
    atEnd,
  } = useReader();
  // Where the book opens. Read once: later saves must not pull the reader back.
  const [startCfi] = useState<string | undefined>(initialLocation);
  const hasMarkedComplete = useRef(false);

  // The page theme the book opens with. The library reads it once on mount;
  // later changes go through changeTheme below.
  const [initialTheme] = useState(() =>
    buildEpubTheme(readerTheme, readerFont, lineHeight),
  );

  // Highlights drawn when the book opens; later ones go through readerApiRef.
  const [initialAnnotations] = useState(() =>
    (highlights as Snippet[]).map((s) => ({
      type: "highlight",
      cfiRange: s.cfi,
      data: { id: s.id },
      styles: { color: s.color, opacity: HIGHLIGHT_OPACITY },
    })),
  );

  // Lets the parent (outside ReaderProvider) draw and clear highlights.
  useEffect(() => {
    readerApiRef.current = {
      addHighlight: (cfi: string, color: string, id: string) =>
        addAnnotation("highlight", cfi, { id }, { color, opacity: HIGHLIGHT_OPACITY }),
      removeHighlight: (cfi: string) => removeAnnotationByCfi(cfi),
      goToHref: (href: string) => injectJavascript(goToHrefJs(href)),
      clearSelection: () =>
        injectJavascript(`
          try {
            rendition.getContents().forEach(function (c) {
              c.window.getSelection().removeAllRanges();
            });
          } catch (e) {}
          true;
        `),
    };
  }, [addAnnotation, removeAnnotationByCfi, injectJavascript, readerApiRef]);

  // Re-apply the reading preferences whenever they change, and once the book
  // is ready (changes made while it was still loading would be lost).
  const applyPrefs = useCallback(() => {
    changeTheme(buildEpubTheme(readerTheme, readerFont, lineHeight));
    changeFontFamily(readerFont.css);
    changeFontSize(`${fontSize}%`);
  }, [readerTheme, readerFont, fontSize, lineHeight, changeTheme, changeFontFamily, changeFontSize]);

  const applyPrefsRef = useRef(applyPrefs);
  useEffect(() => {
    applyPrefsRef.current = applyPrefs;
    applyPrefs();
  }, [applyPrefs]);

  // Jump to the saved place as soon as the first page is shown. (Waiting for
  // onLocationsReady meant that, in long books, a chapter picked from the
  // table of contents was undone when locations finished generating.)
  const stableOnReady = useCallback(() => {
    applyPrefsRef.current();
    if (startCfi) injectJavascript(restoreLocationJs(startCfi));
    onBookOpened();
  }, []);

  const stableOnDisplayError = useCallback((reason: string) => {
    onOpenError(reason);
  }, []);

  const stableOnPressAnnotation = useCallback((annotation: any) => {
    if (annotation?.data?.id) onPressHighlight(annotation.data.id);
  }, []);

  // Persist location + update progress
  useEffect(() => {
    if (currentLocation?.start?.cfi && bookId) {
      updateLocation(bookId, currentLocation.start.cfi);
      setProgress({
        percent: currentLocation.start.percentage || 0,
        cfi: currentLocation.start.cfi,
      });
      // Page info from epub.js displayed object
      if (currentLocation.start.displayed) {
        setPageInfo({
          page: currentLocation.start.displayed.page,
          total: currentLocation.start.displayed.total,
        });
      }
      // Notify parent that the page changed (used for popup dismissal / debounce)
      onPageChanged?.();
    }
  }, [currentLocation, bookId]);

  // Auto-mark completed when reaching the end
  useEffect(() => {
    if (atEnd && bookId && !hasMarkedComplete.current) {
      hasMarkedComplete.current = true;
      onBookFinished();
    }
  }, [atEnd, bookId]);

  // ── Stable callbacks for MemoReader (must never change to avoid re-renders) ──
  const stableExternalLink = useCallback((url: string) => {
    handleExternalLink(url);
  }, []);

  // Stable selection handler — our popup handles dictionary/snippets.
  const stableSelection = useCallback(
    (text: string, cfi: string) => {
      handleSelection(text, cfi);
    },
    [handleSelection],
  );

  const stableOnFinish = useCallback(() => {}, []);
  const stableOnBeginning = useCallback(() => {}, []);

  // onNavigationLoaded — receive TOC + landmarks once
  const stableOnNavLoaded = useCallback(({ toc }: { toc: TocItem[] }) => {
    setTocData(toc);
  }, []);

  // onChangeSection — update chapter label in header
  const stableOnChangeSection = useCallback((section: any) => {
    if (section?.label) setSectionLabel(section.label);
  }, []);

  // onSingleTap — toggle immersive mode
  const stableOnSingleTap = useCallback(() => {
    toggleUI();
  }, []);

  return (
    <MemoizedReader
      src={epubUri}
      fileSystem={() => fs}
      onSelected={stableSelection}
      onPressExternalLink={stableExternalLink}
      onFinish={stableOnFinish}
      onBeginning={stableOnBeginning}
      onNavigationLoaded={stableOnNavLoaded}
      onChangeSection={stableOnChangeSection}
      onSingleTap={stableOnSingleTap}
      onReady={stableOnReady}
      onDisplayError={stableOnDisplayError}
      initialAnnotations={initialAnnotations}
      onPressAnnotation={stableOnPressAnnotation}
      defaultTheme={initialTheme}
      flow={flow}
    />
  );
};

// ─── Page Turner Buttons ─────────────────────────────────────────────────────
// Now always rendered; size adapts to screen width.
const PageTurnerButtons = ({
  compact,
  color,
}: {
  compact?: boolean;
  color: string;
}) => {
  const { goNext, goPrevious, injectJavascript } = useReader();
  const btnWidth = compact ? 36 : 48;
  const iconSize = compact ? 22 : 28;
  return (
    <>
      <TouchableOpacity
        onPress={() => {
          injectJavascript(CANCEL_RESTORE_JS);
          goPrevious();
        }}
        style={[styles.pageTurnLeft, { width: btnWidth }]}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-back" size={iconSize} color={color} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          injectJavascript(CANCEL_RESTORE_JS);
          goNext();
        }}
        style={[styles.pageTurnRight, { width: btnWidth }]}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-forward" size={iconSize} color={color} />
      </TouchableOpacity>
    </>
  );
};

// ─── TOC Panel ───────────────────────────────────────────────────────────────
const TocPanel = ({
  toc,
  visible,
  onClose,
  onSelectChapter,
  theme,
}: {
  toc: TocItem[];
  visible: boolean;
  onClose: () => void;
  onSelectChapter: (href: string) => void;
  theme: ReaderTheme;
}) => {
  if (!visible) return null;

  // Flatten nested TOC items for display (with indent level)
  const flatItems: { item: TocItem; level: number }[] = [];
  const flatten = (items: TocItem[], level: number) => {
    items.forEach((item) => {
      flatItems.push({ item, level });
      if (item.subitems?.length) flatten(item.subitems, level + 1);
    });
  };
  flatten(toc, 0);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.tocOverlay}>
        <View style={[styles.tocContainer, { backgroundColor: theme.chrome }]}>
          <View style={[styles.tocHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.tocTitle, { color: theme.text }]}>
              Table of Contents
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={flatItems}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item: { item, level } }) => (
              <TouchableOpacity
                style={[
                  styles.tocItem,
                  { paddingLeft: 16 + level * 16, borderBottomColor: theme.border },
                ]}
                onPress={() => {
                  onSelectChapter(item.href);
                  onClose();
                }}
              >
                <Text
                  style={[styles.tocItemText, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {item.label.trim()}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── TOC Button (inside ReaderProvider) ──────────────────────────────────────
const TocGoTo = ({ onOpen, color }: { onOpen: () => void; color: string }) => {
  return (
    <TouchableOpacity onPress={onOpen} style={styles.themeBtn}>
      <Ionicons name="list-outline" size={20} color={color} />
    </TouchableOpacity>
  );
};

// ═══ Main Modal ══════════════════════════════════════════════════════════════
export const EpubReaderModal = ({ visible, book, onClose, epubUri }: any) => {
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, cfi: "" });
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [popupData, setPopupData] = useState<any>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [dictDownloading, setDictDownloading] = useState(false);
  const [dictProgress, setDictProgress] = useState(0);
  const [sectionLabel, setSectionLabel] = useState("");
  const [showUI, setShowUI] = useState(true);
  const [tocData, setTocData] = useState<TocItem[]>([]);
  const [tocVisible, setTocVisible] = useState(false);
  const [bookOpened, setBookOpened] = useState(false);
  // Why the book couldn't be shown: file missing, epub.js error, or still
  // not open after OPEN_TIMEOUT_MS.
  const [openProblem, setOpenProblem] = useState<"missing" | "error" | "slow" | null>(null);
  const pendingWordRef = useRef<string | null>(null);
  // Highlight controls exposed by ReaderEngine (lives inside ReaderProvider).
  const readerApiRef = useRef<any>(null);

  // Debounce refs to suppress swipe-triggered selections
  const lastPageChangeTs = useRef<number>(0);
  const lastSelectionTs = useRef<number>(0);

  const fs = useLegacyFileSystem();
  const {
    savedBooks,
    addSnippet,
    updateSnippetColor,
    removeSnippet,
    updateStatus,
    startDownload,
  } = useLibrary();
  const { scheme, readerPrefs, updateReaderPrefs } = useAppTheme();
  const readerTheme = resolveReaderTheme(readerPrefs.theme, scheme);
  const readerFont = resolveReaderFont(readerPrefs.font);
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= LARGE_SCREEN_THRESHOLD;
  const scrolled = readerPrefs.flow === "scrolled";
  const pageEdge = PAGE_VERTICAL_INSET + readerPrefs.margin;
  const percentText = `${Math.round(progress.percent * 100)}%`;

  // Always-current snippets for callbacks the reader captures once.
  const snippets: Snippet[] = useMemo(
    () => savedBooks.find((b: any) => b.id === book?.id)?.snippets || [],
    [savedBooks, book?.id],
  );
  const snippetsRef = useRef(snippets);
  snippetsRef.current = snippets;

  // ── Boot / teardown ──
  useEffect(() => {
    if (visible && epubUri) {
      let cancelled = false;
      const timer = setTimeout(async () => {
        // A missing file would otherwise leave the reader on "Opening..." forever.
        const info = await FileSystem.getInfoAsync(epubUri).catch(() => null);
        if (cancelled) return;
        if (info?.exists) setIsReady(true);
        else setOpenProblem("missing");
      }, 600);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      setIsReady(false);
      setBookOpened(false);
      setOpenProblem(null);
      setSectionLabel("");
      setShowUI(true);
      setPageInfo(null);
      setTocData([]);
    }
  }, [visible, epubUri]);

  // If the book still hasn't opened after a while, say so instead of
  // leaving the reader on "Opening..." with no way forward.
  useEffect(() => {
    if (!isReady || bookOpened) return;
    const timer = setTimeout(
      () => setOpenProblem((p) => p ?? "slow"),
      OPEN_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [isReady, bookOpened]);

  const handleBookOpened = useCallback(() => {
    setBookOpened(true);
    setOpenProblem(null);
  }, []);

  const handleOpenError = useCallback((reason: string) => {
    console.warn("EPUB failed to open:", reason);
    setOpenProblem("error");
  }, []);

  const redownload = (textOnly: boolean) => {
    onClose();
    startDownload(book, { textOnly });
    Alert.alert(
      "Downloading",
      textOnly
        ? `Downloading the text-only edition of "${book.title}". It will open normally once it's ready.`
        : `Downloading "${book.title}" again. It will be ready in your library shortly.`,
    );
  };

  // Auto-set status to "reading" when opening a "toread" book
  useEffect(() => {
    if (visible && book?.id) {
      const entry = savedBooks.find((b: any) => b.id === book.id);
      if (entry && entry.status === "toread") {
        updateStatus(book.id, "reading");
      }
    }
  }, [visible, book?.id]);

  // ── Page-change callback — dismiss popup & mark timestamp for debounce ──
  const handlePageChanged = useCallback(() => {
    lastPageChangeTs.current = Date.now();
    // Dismiss any open popup when the page turns
    setPopupData(null);
  }, []);

  // ── Text selection handler (with debounce to ignore swipe artefacts) ──
  const handleSelection = useCallback(async (text: string, cfi: string) => {
    const now = Date.now();

    // If a page turn just happened, ignore this selection — it's a swipe artefact
    if (now - lastPageChangeTs.current < SELECTION_DEBOUNCE_MS) {
      return;
    }

    // Also debounce rapid-fire duplicate selections
    if (now - lastSelectionTs.current < 150) {
      return;
    }
    lastSelectionTs.current = now;

    const cleanText = text.trim();
    if (!cleanText) return;

    const words = cleanText.split(/\s+/);
    if (words.length > 1) {
      setPopupData({ type: "snippet", content: cleanText, cfi });
    } else {
      const word = cleanText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      if (!word) return; // pure punctuation — ignore
      const definition = await getLocalDefinition(word);
      setPopupData({
        type:
          definition === "NOT_DOWNLOADED" ? "prompt_download" : "definition",
        word,
        content:
          definition === "NOT_DOWNLOADED"
            ? "Dictionary needed"
            : definition || "Not found",
        // Kept so the word itself can be highlighted from the popup.
        selectedText: cleanText,
        cfi,
      });
    }
  }, []);

  // ── Highlights (stored as snippets with a color) ──
  const handleHighlight = async (color: string) => {
    const data = popupData;
    if (!book?.id || !data?.cfi) return;
    setPopupData(null);
    const api = readerApiRef.current;

    if (data.type === "highlight") {
      // Recolor an existing highlight.
      await updateSnippetColor(book.id, data.snippetId, color);
      api?.removeHighlight(data.cfi);
      api?.addHighlight(data.cfi, color, data.snippetId);
      return;
    }

    const text = data.type === "snippet" ? data.content : data.selectedText;
    const snippet = await addSnippet(book.id, text, data.cfi, color);
    if (!snippet) {
      Alert.alert("Couldn't Highlight", "Add this book to your library to save highlights.");
      return;
    }
    api?.addHighlight(data.cfi, color, snippet.id);
    api?.clearSelection();
  };

  const handleRemoveHighlight = async () => {
    const data = popupData;
    if (!book?.id || data?.type !== "highlight") return;
    setPopupData(null);
    readerApiRef.current?.removeHighlight(data.cfi);
    await removeSnippet(book.id, data.snippetId);
  };

  // Tapping a highlight in the page opens it for recolor / delete.
  const handlePressHighlight = useCallback((snippetId: string) => {
    const s = snippetsRef.current.find((x) => x.id === snippetId);
    if (!s?.cfi) return;
    setPopupData({
      type: "highlight",
      content: s.text,
      cfi: s.cfi,
      snippetId: s.id,
      color: s.color,
    });
  }, []);

  // ── External links ──
  const handleExternalLink = useCallback((url: string) => {
    if (!url) return;
    Alert.alert("Open External Link", "This will open in your browser.", [
      { text: "Cancel", style: "cancel" },
      { text: "Open", onPress: () => Linking.openURL(url) },
    ]);
  }, []);

  // ── Auto-complete ──
  const handleBookFinished = useCallback(() => {
    if (!book?.id) return;
    const entry = savedBooks.find((b: any) => b.id === book.id);
    if (entry && entry.status !== "completed") {
      updateStatus(book.id, "completed");
      setTimeout(() => {
        Alert.alert(
          "📖 Book Completed!",
          `You've finished "${book.title}". It's been marked as completed in your library.`,
          [{ text: "Nice!", style: "default" }],
        );
      }, 800);
    }
  }, [book?.id, book?.title, savedBooks]);

  // ── Toggle immersive mode ──
  const toggleUI = useCallback(() => {
    setShowUI((prev) => !prev);
  }, []);

  // ── Saved location lookup ──
  const savedCfi = useMemo(() => {
    if (!book?.id) return undefined;
    return savedBooks.find((b: any) => b.id === book.id)?.lastLocation;
  }, [book?.id, savedBooks]);

  // ── Snippet saving ──
  const handleSaveSnippet = async (text: string) => {
    if (!book?.id) return;
    const cfi = popupData?.cfi;
    setPopupData(null);
    const saved = await addSnippet(book.id, text, cfi);
    Alert.alert(
      saved ? "Saved" : "Couldn't Save",
      saved
        ? "Snippet added. Find all your snippets in the Snippets tab."
        : "Add this book to your library to save snippets.",
    );
  };

  // ── Font size steps ──
  const stepFontSize = (dir: 1 | -1) => {
    const i = READER_FONT_SIZES.indexOf(readerPrefs.fontSize);
    const next = READER_FONT_SIZES[Math.min(READER_FONT_SIZES.length - 1, Math.max(0, i + dir))];
    if (next !== readerPrefs.fontSize) updateReaderPrefs({ fontSize: next });
  };

  // ── Dictionary download ──
  const handleDownloadDictionary = useCallback(async (word?: string) => {
    const lookupWord = word || pendingWordRef.current;
    pendingWordRef.current = lookupWord || null;
    setDictDownloading(true);
    setDictProgress(0);

    setPopupData((prev: any) =>
      prev
        ? { ...prev, type: "downloading", content: "Downloading dictionary..." }
        : null,
    );

    try {
      await downloadDictionary((p: number) => setDictProgress(p));

      if (lookupWord) {
        const definition = await getLocalDefinition(lookupWord);
        setPopupData({
          type: "definition",
          word: lookupWord,
          content:
            definition === "NOT_FOUND" ||
            definition === "NOT_DOWNLOADED" ||
            definition === "ERROR"
              ? "No definition found"
              : definition || "No definition found",
          justDownloaded: true,
        });
      } else {
        setPopupData(null);
        Alert.alert(
          "Dictionary Ready",
          "Dictionary has been downloaded successfully.",
        );
      }
    } catch {
      Alert.alert(
        "Download Failed",
        "Could not download dictionary. Please check your connection and try again.",
      );
      setPopupData(null);
    } finally {
      setDictDownloading(false);
      setDictProgress(0);
      pendingWordRef.current = null;
    }
  }, []);

  // ── TOC chapter select ──
  const handleSelectChapter = useCallback((href: string) => {
    readerApiRef.current?.goToHref(href);
  }, []);

  // ── Guard ──
  if (!visible || !book || !epubUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <ReaderProvider key="stable-epub-context">
        <SafeAreaView
          style={[styles.container, { backgroundColor: readerTheme.background }]}
        >
          <StatusBar style={readerTheme.dark ? "light" : "dark"} />
          {/* ─ Header ─ */}
          {showUI && (
            <View
              style={[
                styles.header,
                { backgroundColor: readerTheme.chrome, borderBottomColor: readerTheme.border },
              ]}
            >
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color={readerTheme.text} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text
                  style={[styles.headerTitle, { color: readerTheme.text }]}
                  numberOfLines={1}
                >
                  {book.title}
                </Text>
                {/* Always rendered (blank until known) so the header keeps
                    one height — resizing the reader while the book opens
                    would throw it back to page one. */}
                <Text
                  style={[styles.chapterLabel, { color: readerTheme.muted }]}
                  numberOfLines={1}
                >
                  {sectionLabel || " "}
                </Text>
              </View>
              <Text style={[styles.progressText, { color: readerTheme.link }]}>
                {percentText}
              </Text>
            </View>
          )}

          {/* ─ Reader ─ */}
          <View style={styles.readerContainer}>
            {isReady ? (
              <>
                {/* The page margin applies on all sides; epub.js re-flows on resize. */}
                <View
                  style={[
                    styles.readerFrame,
                    { paddingHorizontal: readerPrefs.margin, paddingVertical: pageEdge },
                  ]}
                >
                  <ReaderEngine
                    // Switching between pages and scrolling needs a fresh
                    // epub.js rendition; it reopens at the saved place.
                    key={readerPrefs.flow}
                    epubUri={epubUri}
                    fs={fs}
                    initialLocation={savedCfi}
                    handleSelection={handleSelection}
                    handleExternalLink={handleExternalLink}
                    readerTheme={readerTheme}
                    readerFont={readerFont}
                    fontSize={readerPrefs.fontSize}
                    lineHeight={readerPrefs.lineHeight}
                    flow={readerPrefs.flow}
                    bookId={book.id}
                    highlights={snippets.filter((s) => s.color && s.cfi)}
                    readerApiRef={readerApiRef}
                    onBookOpened={handleBookOpened}
                    onOpenError={handleOpenError}
                    onPressHighlight={handlePressHighlight}
                    setProgress={setProgress}
                    setPageInfo={setPageInfo}
                    setSectionLabel={setSectionLabel}
                    onBookFinished={handleBookFinished}
                    setTocData={setTocData}
                    toggleUI={toggleUI}
                    onPageChanged={handlePageChanged}
                  />
                </View>
                {/* Page-turn buttons in page mode; compact on small screens */}
                {!scrolled && (
                  <PageTurnerButtons
                    compact={!isLargeScreen}
                    color={readerTheme.muted}
                  />
                )}
              </>
            ) : !openProblem ? (
              <View style={styles.center}>
                <ActivityIndicator color={readerTheme.link} size="large" />
              </View>
            ) : null}

            {openProblem && (
              <OpenProblemCard
                problem={openProblem}
                theme={readerTheme}
                // Gutenberg books can be fetched again; imported files can't.
                canRedownload={!isImportedBook(book)}
                onKeepWaiting={() => setOpenProblem(null)}
                onRedownload={() => redownload(false)}
                onTextOnly={() => redownload(true)}
                onClose={onClose}
              />
            )}
          </View>

          {/* ─ Immersive bar: sits below the page so it never covers text ─ */}
          {isReady && !showUI && (
            <View style={styles.immersiveBar}>
              <Text style={[styles.pageInfoText, { color: readerTheme.muted, paddingTop: 0 }]}>
                {!scrolled && pageInfo
                  ? `Page ${pageInfo.page} of ${pageInfo.total}`
                  : percentText}
              </Text>
              <TouchableOpacity
                onPress={() => setShowUI(true)}
                style={styles.immersiveExitBtn}
                hitSlop={10}
                accessibilityLabel="Show controls"
              >
                <Ionicons name="contract-outline" size={16} color={readerTheme.muted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ─ Footer ─ */}
          {isReady && showUI && (
            <View
              style={[
                styles.footer,
                { backgroundColor: readerTheme.chrome, borderTopColor: readerTheme.border },
              ]}
            >
              {/* Page info — kept in place while blank, same reason as the header */}
              {!scrolled && (
                <Text style={[styles.pageInfoText, { color: readerTheme.muted }]}>
                  {pageInfo ? `Page ${pageInfo.page} of ${pageInfo.total}` : " "}
                </Text>
              )}
              <View style={styles.themeRow}>
                <TouchableOpacity
                  onPress={() => setSettingsVisible(true)}
                  style={styles.themeBtn}
                  accessibilityLabel="Reading settings"
                >
                  <Text style={[styles.aaText, { color: readerTheme.text }]}>Aa</Text>
                </TouchableOpacity>
                <View style={[styles.divider, { backgroundColor: readerTheme.border }]} />
                <TouchableOpacity
                  onPress={() => stepFontSize(-1)}
                  style={styles.themeBtn}
                  accessibilityLabel="Smaller text"
                >
                  <Ionicons name="remove" size={22} color={readerTheme.text} />
                </TouchableOpacity>
                <Text style={[styles.toolText, { color: readerTheme.muted }]}>
                  {readerPrefs.fontSize}%
                </Text>
                <TouchableOpacity
                  onPress={() => stepFontSize(1)}
                  style={styles.themeBtn}
                  accessibilityLabel="Larger text"
                >
                  <Ionicons name="add" size={22} color={readerTheme.text} />
                </TouchableOpacity>
                {tocData.length > 0 && (
                  <>
                    <View style={[styles.divider, { backgroundColor: readerTheme.border }]} />
                    <TocGoTo
                      onOpen={() => setTocVisible(true)}
                      color={readerTheme.muted}
                    />
                  </>
                )}
                <View style={[styles.divider, { backgroundColor: readerTheme.border }]} />
                <TouchableOpacity
                  onPress={() => setShowUI(false)}
                  style={styles.themeBtn}
                  accessibilityLabel="Hide controls"
                >
                  <Ionicons name="expand-outline" size={18} color={readerTheme.muted} />
                </TouchableOpacity>
              </View>
              <InternalScrubber
                screenWidth={screenWidth}
                progress={progress}
                theme={readerTheme}
              />
            </View>
          )}

          {/* ─ Popups / Overlays ─ */}
          <ReaderPopup
            data={popupData}
            onClose={() => setPopupData(null)}
            onSave={handleSaveSnippet}
            downloading={dictDownloading}
            downloadProgress={dictProgress}
            onDownload={() => handleDownloadDictionary(popupData?.word)}
            onHighlight={handleHighlight}
            onRemoveHighlight={handleRemoveHighlight}
            theme={readerTheme}
          />

          <TocPanel
            toc={tocData}
            visible={tocVisible}
            onClose={() => setTocVisible(false)}
            onSelectChapter={handleSelectChapter}
            theme={readerTheme}
          />

          <ReaderSettingsSheet
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            prefs={readerPrefs}
            onChange={updateReaderPrefs}
            theme={readerTheme}
            scheme={scheme}
          />
        </SafeAreaView>
      </ReaderProvider>
    </Modal>
  );
};

// ─── Sub-components (inside ReaderProvider) ──────────────────────────────────
const InternalScrubber = ({ progress, screenWidth, theme }: any) => {
  const { goToLocation, injectJavascript } = useReader();
  return (
    <Slider
      style={[styles.slider, { width: screenWidth - 40 }]}
      minimumValue={0}
      maximumValue={1}
      value={progress.percent}
      minimumTrackTintColor={theme.link}
      maximumTrackTintColor={theme.border}
      thumbTintColor={theme.link}
      onSlidingComplete={(val) => {
        injectJavascript(CANCEL_RESTORE_JS);
        goToLocation(String(val));
      }}
    />
  );
};

// ─── Shown when a book can't be opened (instead of "Opening..." forever) ─────
const OPEN_PROBLEM_TEXT = {
  missing: {
    title: "Book file missing",
    body: "The downloaded file for this book couldn't be found. Download it again to keep reading — your place and snippets are kept.",
  },
  error: {
    title: "Couldn't open this book",
    body: "This file couldn't be displayed. Downloading it again usually fixes this. If it keeps happening, try the text-only edition.",
  },
  slow: {
    title: "Still opening…",
    body: "This is taking longer than usual. Illustrated editions can be very large for some devices — the text-only edition opens much faster.",
  },
};

const OpenProblemCard = ({
  problem,
  theme,
  canRedownload,
  onKeepWaiting,
  onRedownload,
  onTextOnly,
  onClose,
}: {
  problem: "missing" | "error" | "slow";
  theme: ReaderTheme;
  canRedownload: boolean;
  onKeepWaiting: () => void;
  onRedownload: () => void;
  onTextOnly: () => void;
  onClose: () => void;
}) => {
  const text = OPEN_PROBLEM_TEXT[problem];
  const button = (label: string, onPress: () => void, primary = false) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={[
        styles.problemBtn,
        primary
          ? { backgroundColor: theme.link, borderColor: theme.link }
          : { borderColor: theme.border },
      ]}
    >
      <Text
        style={[
          styles.problemBtnText,
          { color: primary ? theme.background : theme.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.problemOverlay, { backgroundColor: theme.background }]}>
      <View style={[styles.problemCard, { backgroundColor: theme.chrome, borderColor: theme.border }]}>
        <Ionicons
          name={problem === "slow" ? "hourglass-outline" : "alert-circle-outline"}
          size={36}
          color={theme.link}
        />
        <Text style={[styles.problemTitle, { color: theme.text }]}>{text.title}</Text>
        <Text style={[styles.problemBody, { color: theme.muted }]}>
          {canRedownload ? text.body : "This imported file couldn't be opened. Try importing it again."}
        </Text>
        <View style={styles.problemActions}>
          {canRedownload && problem !== "missing" && button("Get Text-only Edition", onTextOnly, true)}
          {canRedownload && problem !== "slow" && button("Download Again", onRedownload, problem === "missing")}
          {problem === "slow" && button("Keep Waiting", onKeepWaiting)}
          {button("Close", onClose)}
        </View>
      </View>
    </View>
  );
};

// ─── Segmented picker used by the settings sheet ─────────────────────────────
const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
  theme,
  renderIcon,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  theme: ReaderTheme;
  renderIcon?: (v: T, color: string) => React.ReactNode;
}) => (
  <View style={[styles.segmented, { borderColor: theme.border }]}>
    {options.map((o) => {
      const active = o.value === value;
      const color = active ? theme.link : theme.muted;
      return (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segment, active && { backgroundColor: theme.background }]}
          accessibilityLabel={o.label}
          accessibilityState={{ selected: active }}
        >
          {renderIcon?.(o.value, color)}
          <Text style={[styles.segmentText, { color }]}>{o.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// Little page diagrams so the options read at a glance.
const MarginIcon = ({ margin, color }: { margin: number; color: string }) => {
  const inset = [1, 3, 5, 7][READER_MARGINS.findIndex((m) => m.value === margin)] ?? 1;
  return (
    <View style={[styles.miniPage, { borderColor: color, paddingHorizontal: inset }]}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.miniLine, { backgroundColor: color }]} />
      ))}
    </View>
  );
};

const LineHeightIcon = ({ lineHeight, color }: { lineHeight: number; color: string }) => (
  <View style={[styles.miniLines, { gap: Math.round((lineHeight - 1) * 6) + 1 }]}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={[styles.miniLine, { backgroundColor: color }]} />
    ))}
  </View>
);

// ─── Reading settings sheet ──────────────────────────────────────────────────
const ReaderSettingsSheet = ({
  visible,
  onClose,
  prefs,
  onChange,
  theme,
  scheme,
}: {
  visible: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  onChange: (patch: Partial<ReaderPrefs>) => void;
  theme: ReaderTheme;
  scheme: "light" | "dark";
}) => {
  if (!visible) return null;
  const autoTheme = resolveReaderTheme("auto", scheme);
  const sizeIndex = READER_FONT_SIZES.indexOf(prefs.fontSize);

  const swatch = (
    id: ReaderPrefs["theme"],
    label: string,
    t: ReaderTheme,
  ) => {
    const active = prefs.theme === id;
    return (
      <TouchableOpacity
        key={id}
        onPress={() => onChange({ theme: id })}
        style={styles.swatchItem}
        accessibilityLabel={`${label} theme`}
        accessibilityState={{ selected: active }}
      >
        <View
          style={[
            styles.swatch,
            { backgroundColor: t.background, borderColor: active ? theme.link : t.border },
            active && styles.swatchActive,
          ]}
        >
          {id === "auto" ? (
            <Ionicons name="contrast-outline" size={20} color={t.text} />
          ) : (
            <Text style={[styles.swatchAa, { color: t.text }]}>Aa</Text>
          )}
        </View>
        <Text
          style={[
            styles.swatchLabel,
            { color: active ? theme.link : theme.muted },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const fontChip = (f: ReaderFont) => {
    const active = resolveReaderFont(prefs.font).id === f.id;
    return (
      <TouchableOpacity
        key={f.id}
        onPress={() => onChange({ font: f.id })}
        style={[
          styles.fontChip,
          {
            borderColor: active ? theme.link : theme.border,
            backgroundColor: active ? theme.background : "transparent",
          },
        ]}
        accessibilityState={{ selected: active }}
      >
        <Text
          style={[
            styles.fontChipText,
            { color: active ? theme.link : theme.text, fontFamily: f.preview },
          ]}
        >
          {f.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.chrome }]}>
          <View style={[styles.tocHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.tocTitle, { color: theme.text }]}>
              Reading Settings
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sheetLabel, { color: theme.muted }]}>THEME</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sheetRow}
          >
            {swatch("auto", "Auto", autoTheme)}
            {READER_THEMES.map((t) => swatch(t.id, t.label, t))}
          </ScrollView>

          <Text style={[styles.sheetLabel, { color: theme.muted }]}>FONT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sheetRow}
          >
            {READER_FONTS.map(fontChip)}
          </ScrollView>

          <Text style={[styles.sheetLabel, { color: theme.muted }]}>TEXT SIZE</Text>
          <View style={[styles.sizeRow, { borderColor: theme.border }]}>
            <TouchableOpacity
              onPress={() =>
                sizeIndex > 0 && onChange({ fontSize: READER_FONT_SIZES[sizeIndex - 1] })
              }
              style={styles.sizeBtn}
              disabled={sizeIndex <= 0}
              accessibilityLabel="Smaller text"
            >
              <Text style={[styles.sizeSmallA, { color: sizeIndex <= 0 ? theme.border : theme.text }]}>
                A
              </Text>
            </TouchableOpacity>
            <Text style={[styles.sizeValue, { color: theme.text }]}>
              {prefs.fontSize}%
            </Text>
            <TouchableOpacity
              onPress={() =>
                sizeIndex < READER_FONT_SIZES.length - 1 &&
                onChange({ fontSize: READER_FONT_SIZES[sizeIndex + 1] })
              }
              style={styles.sizeBtn}
              disabled={sizeIndex >= READER_FONT_SIZES.length - 1}
              accessibilityLabel="Larger text"
            >
              <Text
                style={[
                  styles.sizeLargeA,
                  {
                    color:
                      sizeIndex >= READER_FONT_SIZES.length - 1 ? theme.border : theme.text,
                  },
                ]}
              >
                A
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetLabel, { color: theme.muted }]}>PAGE TURNING</Text>
          <Segmented
            options={READER_FLOWS}
            value={prefs.flow}
            onChange={(flow) => onChange({ flow })}
            theme={theme}
            renderIcon={(v, color) => (
              <Ionicons
                name={v === "scrolled" ? "swap-vertical-outline" : "book-outline"}
                size={18}
                color={color}
              />
            )}
          />

          <Text style={[styles.sheetLabel, { color: theme.muted }]}>PAGE MARGINS</Text>
          <Segmented
            options={READER_MARGINS}
            value={prefs.margin}
            onChange={(margin) => onChange({ margin })}
            theme={theme}
            renderIcon={(v, color) => <MarginIcon margin={v} color={color} />}
          />

          <Text style={[styles.sheetLabel, { color: theme.muted }]}>LINE SPACING</Text>
          <Segmented
            options={READER_LINE_HEIGHTS}
            value={prefs.lineHeight}
            onChange={(lineHeight) => onChange({ lineHeight })}
            theme={theme}
            renderIcon={(v, color) => <LineHeightIcon lineHeight={v} color={color} />}
          />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, marginHorizontal: 10 },
  headerTitle: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 13,
  },
  chapterLabel: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 2,
  },
  progressText: { fontSize: 11, fontWeight: "bold" },
  // Reader
  readerContainer: { flex: 1 },
  readerFrame: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  // Footer
  footer: {
    borderTopWidth: 1,
    paddingBottom: 20,
  },
  pageInfoText: {
    fontSize: 10,
    textAlign: "center",
    paddingTop: 8,
  },
  themeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  themeBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  aaText: { fontSize: 17, fontWeight: "600", fontFamily: "Georgia" },
  toolText: { fontSize: 11, fontWeight: "bold", minWidth: 34, textAlign: "center" },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
  slider: { alignSelf: "center", height: 40 },
  // Page turners — always visible, narrower on small screens
  pageTurnLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  pageTurnRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  // Immersive mode bar
  immersiveBar: {
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  immersiveExitBtn: {
    position: "absolute",
    right: 14,
    padding: 4,
  },
  // TOC panel
  tocOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  tocContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: 30,
  },
  tocHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  tocTitle: { fontSize: 16, fontWeight: "bold" },
  tocItem: {
    paddingVertical: 14,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tocItemText: { fontSize: 14 },
  // Reading settings sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 36,
    maxHeight: "88%",
  },
  sheetLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sheetRow: { paddingHorizontal: 16, gap: 12 },
  swatchItem: { alignItems: "center", gap: 6 },
  swatch: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchActive: { borderWidth: 3 },
  swatchAa: { fontSize: 18, fontWeight: "600", fontFamily: "Georgia" },
  swatchLabel: { fontSize: 11, fontWeight: "600" },
  fontChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fontChipText: { fontSize: 15 },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  sizeBtn: { paddingHorizontal: 28, paddingVertical: 10 },
  sizeSmallA: { fontSize: 15, fontWeight: "600" },
  sizeLargeA: { fontSize: 24, fontWeight: "600" },
  sizeValue: { fontSize: 14, fontWeight: "700" },
  segmented: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    gap: 5,
  },
  segmentText: { fontSize: 11, fontWeight: "600" },
  miniPage: {
    width: 20,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 3,
    justifyContent: "center",
    gap: 2.5,
  },
  miniLines: { width: 18, height: 24, justifyContent: "center" },
  miniLine: { height: 1.5, borderRadius: 1 },
  // Book-won't-open card
  problemOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 20,
  },
  problemCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
  },
  problemTitle: { fontSize: 17, fontWeight: "700", marginTop: 10, textAlign: "center" },
  problemBody: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  problemActions: { alignSelf: "stretch", marginTop: 18, gap: 10 },
  problemBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  problemBtnText: { fontSize: 15, fontWeight: "600" },
});
