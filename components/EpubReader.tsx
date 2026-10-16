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
  READER_FONT_SIZES,
  READER_FONTS,
  READER_THEMES,
  ReaderFont,
  ReaderPrefs,
  ReaderTheme,
  resolveReaderFont,
  resolveReaderTheme,
} from "@/constants/ReaderThemes";
import { useLibrary } from "@/context/LibraryContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useLegacyFileSystem } from "@/hooks/useLegacyFileSystem";
import { downloadDictionary, getLocalDefinition } from "@/utils/Dictionary";
import { MemoizedReader } from "./MemoReader";
import { ReaderPopup } from "./ReaderPopup";

const LARGE_SCREEN_THRESHOLD = 768;

// Minimum time (ms) between page-turn and allowing a new selection popup.
// Prevents swipe gestures from accidentally triggering word lookups.
const SELECTION_DEBOUNCE_MS = 400;

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
  bookId,
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
    goToLocation,
    changeTheme,
    changeFontFamily,
    changeFontSize,
    currentLocation,
    atEnd,
  } = useReader();
  const hasJumped = useRef(false);
  const hasMarkedComplete = useRef(false);

  // The page theme the book opens with. The library reads it once on mount;
  // later changes go through changeTheme below.
  const [initialTheme] = useState(() => buildEpubTheme(readerTheme, readerFont));

  // Re-apply the reading preferences whenever they change, and once the book
  // is ready (changes made while it was still loading would be lost).
  const applyPrefs = useCallback(() => {
    changeTheme(buildEpubTheme(readerTheme, readerFont));
    changeFontFamily(readerFont.css);
    changeFontSize(`${fontSize}%`);
  }, [readerTheme, readerFont, fontSize, changeTheme, changeFontFamily, changeFontSize]);

  const applyPrefsRef = useRef(applyPrefs);
  useEffect(() => {
    applyPrefsRef.current = applyPrefs;
    applyPrefs();
  }, [applyPrefs]);

  const stableOnReady = useCallback(() => {
    applyPrefsRef.current();
  }, []);

  const handleLocationsReady = useCallback(() => {
    if (initialLocation && !hasJumped.current) {
      goToLocation(initialLocation);
      hasJumped.current = true;
    }
  }, [initialLocation, goToLocation]);

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
      onLocationsReady={handleLocationsReady}
      onPressExternalLink={stableExternalLink}
      onFinish={stableOnFinish}
      onBeginning={stableOnBeginning}
      onNavigationLoaded={stableOnNavLoaded}
      onChangeSection={stableOnChangeSection}
      onSingleTap={stableOnSingleTap}
      onReady={stableOnReady}
      defaultTheme={initialTheme}
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
  const { goNext, goPrevious } = useReader();
  const btnWidth = compact ? 36 : 48;
  const iconSize = compact ? 22 : 28;
  return (
    <>
      <TouchableOpacity
        onPress={() => goPrevious()}
        style={[styles.pageTurnLeft, { width: btnWidth }]}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-back" size={iconSize} color={color} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => goNext()}
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

// ─── Internal TOC navigation helper (inside ReaderProvider) ──────────────────
const TocNavigator = ({
  targetHref,
  onDone,
}: {
  targetHref: string | null;
  onDone: () => void;
}) => {
  const { goToLocation } = useReader();
  useEffect(() => {
    if (targetHref) {
      goToLocation(targetHref);
      onDone();
    }
  }, [targetHref]);
  return null;
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
  const [tocTarget, setTocTarget] = useState<string | null>(null);
  const pendingWordRef = useRef<string | null>(null);

  // Debounce refs to suppress swipe-triggered selections
  const lastPageChangeTs = useRef<number>(0);
  const lastSelectionTs = useRef<number>(0);

  const fs = useLegacyFileSystem();
  const { savedBooks, addSnippet, updateStatus } = useLibrary();
  const { scheme, readerPrefs, updateReaderPrefs } = useAppTheme();
  const readerTheme = resolveReaderTheme(readerPrefs.theme, scheme);
  const readerFont = resolveReaderFont(readerPrefs.font);
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= LARGE_SCREEN_THRESHOLD;

  // ── Boot / teardown ──
  useEffect(() => {
    if (visible && epubUri) {
      const timer = setTimeout(() => setIsReady(true), 600);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
      setSectionLabel("");
      setShowUI(true);
      setPageInfo(null);
      setTocData([]);
    }
  }, [visible, epubUri]);

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
      });
    }
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
    setTocTarget(href);
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
                {sectionLabel ? (
                  <Text
                    style={[styles.chapterLabel, { color: readerTheme.muted }]}
                    numberOfLines={1}
                  >
                    {sectionLabel}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.progressText, { color: readerTheme.link }]}>
                {Math.round(progress.percent * 100)}%
              </Text>
            </View>
          )}

          {/* ─ Reader ─ */}
          <View style={styles.readerContainer}>
            {isReady ? (
              <>
                <ReaderEngine
                  epubUri={epubUri}
                  fs={fs}
                  initialLocation={savedCfi}
                  handleSelection={handleSelection}
                  handleExternalLink={handleExternalLink}
                  readerTheme={readerTheme}
                  readerFont={readerFont}
                  fontSize={readerPrefs.fontSize}
                  bookId={book.id}
                  setProgress={setProgress}
                  setPageInfo={setPageInfo}
                  setSectionLabel={setSectionLabel}
                  onBookFinished={handleBookFinished}
                  setTocData={setTocData}
                  toggleUI={toggleUI}
                  onPageChanged={handlePageChanged}
                />
                {/* Invisible component to navigate when TOC item is tapped */}
                <TocNavigator
                  targetHref={tocTarget}
                  onDone={() => setTocTarget(null)}
                />
                {/* Always show page-turn buttons; compact on small screens */}
                <PageTurnerButtons
                  compact={!isLargeScreen}
                  color={readerTheme.muted}
                />
                {/* Floating button to exit immersive mode */}
                {!showUI && (
                  <TouchableOpacity
                    onPress={() => setShowUI(true)}
                    style={[
                      styles.immersiveExitBtn,
                      { backgroundColor: readerTheme.chrome, borderColor: readerTheme.border },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="contract-outline"
                      size={16}
                      color={readerTheme.muted}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.center}>
                <ActivityIndicator color={readerTheme.link} size="large" />
              </View>
            )}
          </View>

          {/* ─ Footer ─ */}
          {isReady && showUI && (
            <View
              style={[
                styles.footer,
                { backgroundColor: readerTheme.chrome, borderTopColor: readerTheme.border },
              ]}
            >
              {/* Page info */}
              {pageInfo && (
                <Text style={[styles.pageInfoText, { color: readerTheme.muted }]}>
                  Page {pageInfo.page} of {pageInfo.total}
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
  const { goToLocation } = useReader();
  return (
    <Slider
      style={[styles.slider, { width: screenWidth - 40 }]}
      minimumValue={0}
      maximumValue={1}
      value={progress.percent}
      minimumTrackTintColor={theme.link}
      maximumTrackTintColor={theme.border}
      thumbTintColor={theme.link}
      onSlidingComplete={(val) => goToLocation(String(val))}
    />
  );
};

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
  // Immersive mode exit
  immersiveExitBtn: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    zIndex: 10,
    borderWidth: 1,
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
});
