import { ReaderProvider, useReader } from "@epubjs-react-native/core";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
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
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLibrary } from "@/context/LibraryContext";
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
  settings,
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
  const { goToLocation, changeFontFamily, currentLocation, atEnd } =
    useReader();
  const hasJumped = useRef(false);
  const hasMarkedComplete = useRef(false);

  useEffect(() => {
    if (settings.font) changeFontFamily(settings.font);
  }, [settings.font, changeFontFamily]);

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
      defaultTheme={{
        body: {
          background: "#050505 !important",
          color: "#CCCCCC !important",
          "font-family": `${settings.font} !important`,
        },
      }}
    />
  );
};

// ─── Page Turner Buttons ─────────────────────────────────────────────────────
// Now always rendered; size adapts to screen width.
const PageTurnerButtons = ({ compact }: { compact?: boolean }) => {
  const { goNext, goPrevious } = useReader();
  const btnWidth = compact ? 36 : 48;
  const iconSize = compact ? 22 : 28;
  return (
    <>
      <TouchableOpacity
        onPress={goPrevious}
        style={[styles.pageTurnLeft, { width: btnWidth }]}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-back" size={iconSize} color="#888" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={goNext}
        style={[styles.pageTurnRight, { width: btnWidth }]}
        activeOpacity={0.6}
      >
        <Ionicons name="chevron-forward" size={iconSize} color="#888" />
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
}: {
  toc: TocItem[];
  visible: boolean;
  onClose: () => void;
  onSelectChapter: (href: string) => void;
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
        <View style={styles.tocContainer}>
          <View style={styles.tocHeader}>
            <Text style={styles.tocTitle}>Table of Contents</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={flatItems}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item: { item, level } }) => (
              <TouchableOpacity
                style={[styles.tocItem, { paddingLeft: 16 + level * 16 }]}
                onPress={() => {
                  onSelectChapter(item.href);
                  onClose();
                }}
              >
                <Text style={styles.tocItemText} numberOfLines={2}>
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
const TocGoTo = ({ onOpen }: { onOpen: () => void }) => {
  return (
    <TouchableOpacity onPress={onOpen} style={styles.themeBtn}>
      <Ionicons name="list-outline" size={18} color="#888" />
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
  const [settings, setSettings] = useState({ font: "Georgia, serif" });
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
  const { savedBooks, updateNotes, updateStatus } = useLibrary();
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
  const handleSaveSnippet = (text: string) => {
    if (!book?.id) return;
    const existing = savedBooks.find((b: any) => b.id === book.id);
    const newNote = existing?.notes
      ? `${existing.notes}\n\nSnippet: "${text}"`
      : `Snippet: "${text}"`;
    updateNotes(book.id, newNote);
    setPopupData(null);
    Alert.alert("Saved", "Snippet added to your book notes.");
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
        <SafeAreaView style={styles.container}>
          {/* ─ Header ─ */}
          {showUI && (
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {book.title}
                </Text>
                {sectionLabel ? (
                  <Text style={styles.chapterLabel} numberOfLines={1}>
                    {sectionLabel}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.progressText}>
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
                  settings={settings}
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
                <PageTurnerButtons compact={!isLargeScreen} />
                {/* Floating button to exit immersive mode */}
                {!showUI && (
                  <TouchableOpacity
                    onPress={() => setShowUI(true)}
                    style={styles.immersiveExitBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="contract-outline" size={16} color="#999" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.center}>
                <ActivityIndicator color="#2DDA93" size="large" />
              </View>
            )}
          </View>

          {/* ─ Footer ─ */}
          {isReady && showUI && (
            <View style={styles.footer}>
              {/* Page info */}
              {pageInfo && (
                <Text style={styles.pageInfoText}>
                  Page {pageInfo.page} of {pageInfo.total}
                </Text>
              )}
              <View style={styles.themeRow}>
                <TouchableOpacity
                  onPress={() => setSettings({ font: "Georgia, serif" })}
                  style={styles.themeBtn}
                >
                  <Text
                    style={[
                      styles.themeBtnText,
                      settings.font.includes("Georgia") && { color: "#2DDA93" },
                    ]}
                  >
                    SERIF
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSettings({ font: "system-ui" })}
                  style={styles.themeBtn}
                >
                  <Text
                    style={[
                      styles.toolText,
                      settings.font.includes("system") && { color: "#2DDA93" },
                    ]}
                  >
                    SANS
                  </Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <InternalFontSizers />
                <View style={styles.divider} />
                {tocData.length > 0 && (
                  <TocGoTo onOpen={() => setTocVisible(true)} />
                )}
                <View style={styles.divider} />
                <TouchableOpacity
                  onPress={() => setShowUI(false)}
                  style={styles.themeBtn}
                >
                  <Ionicons name="expand-outline" size={18} color="#888" />
                </TouchableOpacity>
              </View>
              <InternalScrubber screenWidth={screenWidth} progress={progress} />
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
          />

          <TocPanel
            toc={tocData}
            visible={tocVisible}
            onClose={() => setTocVisible(false)}
            onSelectChapter={handleSelectChapter}
          />
        </SafeAreaView>
      </ReaderProvider>
    </Modal>
  );
};

// ─── Sub-components (inside ReaderProvider) ──────────────────────────────────
const InternalFontSizers = () => {
  const { changeFontSize } = useReader();
  return (
    <View style={{ flexDirection: "row", gap: 20 }}>
      <TouchableOpacity onPress={() => changeFontSize("115%")}>
        <Ionicons name="add" size={22} color="#FFF" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => changeFontSize("85%")}>
        <Ionicons name="remove" size={22} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const InternalScrubber = ({ progress, screenWidth }: any) => {
  const { goToLocation } = useReader();
  return (
    <Slider
      style={[styles.slider, { width: screenWidth - 40 }]}
      minimumValue={0}
      maximumValue={1}
      value={progress.percent}
      minimumTrackTintColor="#2DDA93"
      maximumTrackTintColor="#333"
      thumbTintColor="#2DDA93"
      onSlidingComplete={(val) => goToLocation(val)}
    />
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerCenter: { flex: 1, marginHorizontal: 10 },
  headerTitle: {
    color: "#FFF",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 13,
  },
  chapterLabel: {
    color: "#888",
    textAlign: "center",
    fontSize: 11,
    marginTop: 2,
  },
  progressText: { color: "#2DDA93", fontSize: 11, fontWeight: "bold" },
  // Reader
  readerContainer: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  // Footer
  footer: {
    backgroundColor: "#111",
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingBottom: 20,
  },
  pageInfoText: {
    color: "#555",
    fontSize: 10,
    textAlign: "center",
    paddingTop: 8,
  },
  themeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 15,
    gap: 15,
  },
  themeBtn: { paddingHorizontal: 12 },
  themeBtnText: { color: "#666", fontSize: 11, fontWeight: "bold" },
  toolText: { color: "#666", fontSize: 11, fontWeight: "bold" },
  divider: { width: 1, height: 20, backgroundColor: "#333" },
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
    backgroundColor: "rgba(30,30,30,0.85)",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  // TOC panel
  tocOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  tocContainer: {
    backgroundColor: "#111",
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
    borderBottomColor: "#222",
  },
  tocTitle: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  tocItem: {
    paddingVertical: 14,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  tocItemText: { color: "#CCC", fontSize: 14 },
});
