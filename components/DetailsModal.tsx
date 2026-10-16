import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppPalette } from "../constants/theme";
import { useLibrary } from "../context/LibraryContext";
import { useAppTheme, useThemedStyles } from "../context/ThemeContext";
import { isImportedBook } from "../utils/LocalBooks";

const MAX_CONTENT_WIDTH = 650;

const ShineButton = ({
  onPress,
  text,
  disabled,
  loading,
  progress,
  style,
}: any) => {
  const { width: windowWidth } = useWindowDimensions();
  const styles = useThemedStyles(makeStyles);
  const shineAnim = useRef(new Animated.Value(-100)).current;
  const progressPct = Math.round((progress || 0) * 100);

  useEffect(() => {
    if (disabled || loading) return;
    const loop = Animated.loop(
      Animated.timing(shineAnim, {
        toValue: windowWidth,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, loading, windowWidth]);

  return (
    <TouchableOpacity
      style={[
        styles.mainBtn,
        styles.downloadBtn,
        disabled && styles.disabledBtn,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <View
        style={{
          overflow: "hidden",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Progress fill bar behind the text */}
        {loading && progressPct > 0 && (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progressPct}%` as any,
              backgroundColor: "rgba(0,0,0,0.15)",
            }}
          />
        )}
        {!disabled && !loading && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: 30,
              backgroundColor: "rgba(255,255,255,0.4)",
              transform: [{ translateX: shineAnim }, { skewX: "-20deg" }],
            }}
          />
        )}
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ActivityIndicator color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>
              {progressPct > 0
                ? `DOWNLOADING ${progressPct}%`
                : "DOWNLOADING..."}
            </Text>
          </View>
        ) : (
          <Text style={styles.btnText}>{text}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const DetailsModal = ({
  book,
  visible,
  onClose,
  onRead,
  onReadEpub,
}: any) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const {
    savedBooks,
    updateStatus,
    updateNotes,
    removeBook,
    saveBook,
    startDownload,
    activeDownload,
    downloadProgress,
    removeSnippet,
  } = useLibrary();

  const [downloadingCover, setDownloadingCover] = useState(false);
  const [notes, setNotes] = useState("");

  const isTablet = windowWidth >= 768;
  const coverSize = useMemo(() => {
    const size = isTablet ? 240 : windowWidth * 0.45;
    return { width: size, height: size * 1.5 };
  }, [windowWidth, isTablet]);

  const libraryEntry = book ? savedBooks.find((b) => b.id === book.id) : null;
  const isDownloadingThis = activeDownload && activeDownload.id === book?.id;
  const isDownloaded = !!(libraryEntry?.readerUri || libraryEntry?.localUri);

  useEffect(() => {
    if (book && libraryEntry) setNotes(libraryEntry.notes);
    else setNotes("");
  }, [book, libraryEntry]);

  if (!book) return null;

  const isLocal = isImportedBook(book);
  const coverUrl = book.formats["image/jpeg"];
  const authorName =
    book.authors[0]?.name.split(",").reverse().join(" ").trim() || "Unknown";

  const handleReadChoice = () => {
    if (libraryEntry?.localUri) {
      onClose();
      setTimeout(() => onReadEpub(libraryEntry.localUri!), 300);
    } else if (libraryEntry?.readerUri) {
      onClose();
      setTimeout(() => onRead(libraryEntry.readerUri!), 300);
    }
  };

  const handleExport = async () => {
    const uri = libraryEntry?.localUri || libraryEntry?.readerUri;
    if (uri && (await Sharing.isAvailableAsync()))
      await Sharing.shareAsync(uri);
  };

  const handleManageBook = () => {
    if (isLocal) {
      Alert.alert(
        "Manage Book",
        "Removing deletes Vellum's copy, progress and notes. The original file on your device is not affected.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove from Library",
            style: "destructive",
            onPress: () => {
              onClose();
              removeBook(book.id);
            },
          },
        ],
      );
      return;
    }
    Alert.alert("Manage Book", "Choose an action for this book.", [
      { text: "Cancel", style: "cancel" },
      { text: "Redownload (Repair)", onPress: () => startDownload(book) },
      {
        text: "Delete from Device",
        style: "destructive",
        onPress: () => removeBook(book.id),
      },
    ]);
  };

  const confirmRemoveSnippet = (snippetId: string) => {
    Alert.alert("Delete Snippet", "Remove this snippet from your collection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeSnippet(book.id, snippetId),
      },
    ]);
  };

  // ── Save Cover Art ─────────────────────────────────────────────────────────
  const handleSaveCover = async () => {
    if (!coverUrl) {
      Alert.alert("No Cover", "This book does not have cover art available.");
      return;
    }

    setDownloadingCover(true);

    try {
      // 1. Download image to local cache (imported books already have it on disk)
      let downloadResult: { uri: string; status: number };
      if (coverUrl.startsWith("file://")) {
        downloadResult = { uri: coverUrl, status: 200 };
      } else {
        const filename = `cover_${book.id}_${Date.now()}.jpg`;
        const localUri = `${FileSystem.cacheDirectory}${filename}`;
        downloadResult = await FileSystem.downloadAsync(coverUrl, localUri);
      }
      const localUri = downloadResult.uri;

      if (downloadResult.status !== 200) {
        throw new Error("Failed to download cover image");
      }

      // 2. Try to save to device media library (iOS & Android)
      if (Platform.OS === "web") {
        // Web: fall back to sharing / opening in new tab
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
        } else {
          Alert.alert("Saved", "Cover image downloaded to cache.");
        }
      } else {
        // Native: request media library permission then save
        let { status } = permissionResponse ?? {};
        if (status !== "granted") {
          const result = await requestPermission();
          status = result?.status;
        }

        if (status === "granted") {
          const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
          Alert.alert(
            "Saved!",
            "Cover art has been saved to your photo library.",
          );
        } else {
          // Permission denied — fall back to share sheet
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: "image/jpeg",
              dialogTitle: "Save Cover Art",
            });
          } else {
            Alert.alert(
              "Permission Required",
              "Photo library access is needed to save the cover. Please enable it in Settings.",
            );
          }
        }
      }
    } catch (e) {
      console.error("Save cover error:", e);
      Alert.alert("Error", "Could not save the cover art. Please try again.");
    } finally {
      setDownloadingCover(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      transparent
    >
      <View style={styles.container}>
        {coverUrl && (
          <Image
            source={{ uri: coverUrl }}
            style={styles.ambientBg}
            blurRadius={90}
          />
        )}
        <View style={styles.overlay} />

        <View style={styles.responsiveWrapper}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { top: insets.top + 10 }]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 60 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.coverWrapper,
                { width: coverSize.width, height: coverSize.height },
              ]}
            >
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={styles.cover}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Ionicons
                    name="book-outline"
                    size={56}
                    color={colors.textFaint}
                  />
                </View>
              )}
            </View>

            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{authorName}</Text>

            <View style={styles.actionRow}>
              {isDownloaded ? (
                <>
                  <TouchableOpacity
                    style={[styles.mainBtn, styles.readBtn, { flex: 1.5 }]}
                    onPress={handleReadChoice}
                  >
                    <Text style={[styles.btnText, { color: colors.onInverse }]}>
                      READ BOOK
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.mainBtn,
                      styles.secondaryActionBtn,
                      { flex: 1 },
                    ]}
                    onPress={handleExport}
                  >
                    <Text style={[styles.btnText, { color: colors.text }]}>
                      EXPORT
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={handleManageBook}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={22}
                      color={colors.accentText}
                    />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <ShineButton
                      onPress={() => startDownload(book)}
                      text="DOWNLOAD"
                      disabled={isDownloadingThis}
                      loading={isDownloadingThis}
                      progress={downloadProgress}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => saveBook(book)}
                  >
                    <Ionicons
                      name={libraryEntry ? "bookmark" : "bookmark-outline"}
                      size={24}
                      color={colors.accentText}
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {coverUrl && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleSaveCover}
                disabled={downloadingCover}
                activeOpacity={0.7}
              >
                {downloadingCover ? (
                  <ActivityIndicator
                    color={colors.accentText}
                    size="small"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={20}
                    color={colors.accentText}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={styles.secondaryBtnText}>
                  {downloadingCover ? "Saving..." : "Save Cover Art"}
                </Text>
              </TouchableOpacity>
            )}

            {libraryEntry && (
              <View style={styles.libraryPanel}>
                <Text style={styles.sectionHeader}>Library Progress</Text>
                <View style={styles.statusRow}>
                  {["toread", "reading", "completed"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => updateStatus(book.id, s as any)}
                      style={[
                        styles.statusChip,
                        libraryEntry.status === s && {
                          backgroundColor: colors.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          libraryEntry.status === s && { color: "#000" },
                        ]}
                      >
                        {s.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  placeholder="Personal notes..."
                  placeholderTextColor={colors.textFaint}
                  value={notes}
                  onChangeText={(t) => {
                    setNotes(t);
                    updateNotes(book.id, t);
                  }}
                />
                {!!libraryEntry.snippets?.length && (
                  <View style={styles.snippetsBlock}>
                    <Text style={styles.sectionHeader}>
                      Saved Snippets ({libraryEntry.snippets.length})
                    </Text>
                    {[...libraryEntry.snippets].reverse().map((snippet) => (
                      <View key={snippet.id} style={styles.snippetRow}>
                        <Text style={styles.snippetText}>“{snippet.text}”</Text>
                        <TouchableOpacity
                          onPress={() => confirmRemoveSnippet(snippet.id)}
                          hitSlop={10}
                          accessibilityLabel="Delete snippet"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {isLocal ? (
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>SOURCE</Text>
                  <Text style={styles.metaValue}>DEVICE</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>LANGUAGE</Text>
                  <Text style={styles.metaValue}>
                    {book.languages[0]?.toUpperCase() || "—"}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>TYPE</Text>
                  <Text style={styles.metaValue}>EPUB</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>ADDED</Text>
                  <Text style={styles.metaValue}>
                    {libraryEntry
                      ? new Date(libraryEntry.dateAdded).toLocaleDateString()
                      : "—"}
                  </Text>
                </View>
                {book.publisher ? (
                  <View style={[styles.metaItem, { width: "100%" }]}>
                    <Text style={styles.metaLabel}>PUBLISHER</Text>
                    <Text style={styles.metaValue}>{book.publisher}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>DOWNLOADS</Text>
                  <Text style={styles.metaValue}>
                    {book.download_count.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>LANGUAGE</Text>
                  <Text style={styles.metaValue}>
                    {book.languages[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>TYPE</Text>
                  <Text style={styles.metaValue}>
                    {book.media_type.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>ID</Text>
                  <Text style={styles.metaValue}>#{book.id}</Text>
                </View>
              </View>
            )}

            <Text style={styles.desc}>
              {book.summaries?.[0] ||
                (isLocal
                  ? "This file doesn't include a description."
                  : "No summary available for this classic.")}
            </Text>

            <View style={styles.tagRow}>
              {[...(book.subjects || []), ...(book.bookshelves || [])]
                .slice(0, 10)
                .map((s: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>
                      {s.replace("Category: ", "").split(" -- ")[0]}
                    </Text>
                  </View>
                ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
    },
    responsiveWrapper: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, flex: 1 },
    ambientBg: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.background,
      opacity: 0.85,
    },
    closeBtn: {
      position: "absolute",
      right: 20,
      zIndex: 50,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      borderRadius: 25,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 100,
      alignItems: "center",
    },
    coverWrapper: {
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
      marginBottom: 30,
    },
    coverPlaceholder: {
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    cover: {
      width: "100%",
      height: "100%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    title: {
      fontSize: 26,
      fontWeight: "900",
      color: c.text,
      textAlign: "center",
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    author: {
      fontSize: 18,
      color: c.textMuted,
      textAlign: "center",
      marginBottom: 30,
    },
    actionRow: {
      flexDirection: "row",
      width: "100%",
      gap: 10,
      marginBottom: 24,
    },
    mainBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    downloadBtn: { backgroundColor: c.accent },
    readBtn: { backgroundColor: c.inverse },
    secondaryActionBtn: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    disabledBtn: { backgroundColor: c.border },
    btnText: {
      fontWeight: "900",
      fontSize: 12,
      letterSpacing: 1,
      color: c.onAccent,
    },
    iconBtn: {
      width: 56,
      height: 56,
      backgroundColor: c.surface,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    libraryPanel: {
      width: "100%",
      backgroundColor: c.surface,
      padding: 20,
      borderRadius: 16,
      marginBottom: 30,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionHeader: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: "900",
      marginBottom: 15,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    statusRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
    statusChip: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    statusText: { color: c.textMuted, fontSize: 10, fontWeight: "800" },
    notesInput: {
      backgroundColor: c.background,
      color: c.text,
      borderRadius: 10,
      padding: 15,
      minHeight: 120,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: c.border,
      fontSize: 15,
    },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      width: "100%",
      marginBottom: 30,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
    },
    metaItem: { width: "50%", marginBottom: 15, alignItems: "center" },
    metaLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: "900",
      marginBottom: 4,
    },
    metaValue: { color: c.text, fontSize: 14, fontWeight: "700" },
    desc: {
      color: c.textMuted,
      lineHeight: 26,
      fontSize: 16,
      marginBottom: 40,
      width: "100%",
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginBottom: 40,
    },
    tag: {
      backgroundColor: c.surface,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    tagText: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
    secondaryBtn: {
      flexDirection: "row",
      width: "100%",
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
      marginBottom: 24,
    },
    secondaryBtnText: { color: c.accentText, fontWeight: "700", fontSize: 14 },
    snippetsBlock: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    snippetRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    snippetText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      fontStyle: "italic",
    },
  });
