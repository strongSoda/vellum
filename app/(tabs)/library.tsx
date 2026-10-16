import { EpubReaderModal } from "@/components/EpubReader";
import { ReaderModal } from "@/components/Reader";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookCard } from "../../components/BookCard";
import { DetailsModal } from "../../components/DetailsModal";
import { SavedBook, useLibrary } from "../../context/LibraryContext";

const FILTERS = [
  { key: "all", label: "ALL" },
  { key: "toread", label: "TO READ" },
  { key: "reading", label: "READING" },
  { key: "completed", label: "DONE" },
] as const;

export default function LibraryScreen() {
  const { savedBooks, isLoaded, importBook } = useLibrary();
  const { importUri } = useLocalSearchParams<{ importUri?: string }>();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [importing, setImporting] = useState(false);
  const handledImportUri = useRef<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const { width } = useWindowDimensions();
  const numColumns = Math.max(2, Math.floor(width / 170));

  // --- Reader State (same pattern as Home screen) ---
  const [readerVisible, setReaderVisible] = useState(false);
  const [readerUri, setReaderUri] = useState<string | null>(null);
  const [readerBook, setReaderBook] = useState<any>(null);

  const [epubVisible, setEpubVisible] = useState(false);
  const [activeReaderData, setActiveReaderData] = useState<{
    book: any;
    uri: string;
  } | null>(null);

  const filteredData =
    filter === "all"
      ? savedBooks
      : savedBooks.filter((b) => b.status === filter);

  // Convert SavedBook back to format BookCard expects (it expects the 'book' prop inside)
  const displayData = filteredData.map((sb) => sb.book);

  const handleOpenReader = (uri: string) => {
    setReaderUri(uri);
    setReaderBook(selectedBook);
    setSelectedBook(null);
    setTimeout(() => setReaderVisible(true), 300);
  };

  const handleOpenEpub = (uri: string) => {
    setActiveReaderData({ book: selectedBook, uri });
    setSelectedBook(null);
    setTimeout(() => setEpubVisible(true), 600);
  };

  // ── Local EPUB import ──
  const openImported = (entry: SavedBook) => {
    if (!entry.localUri) return;
    const open = () => {
      setActiveReaderData({ book: entry.book, uri: entry.localUri! });
      setEpubVisible(true);
    };
    // iOS can only present one modal at a time — let any open one dismiss first.
    const needsWait = epubVisible || readerVisible || !!selectedBook;
    setSelectedBook(null);
    setEpubVisible(false);
    setReaderVisible(false);
    setTimeout(open, needsWait ? 600 : 0);
  };

  // A file opened with Vellum from outside the app (see app/+native-intent.tsx).
  // Waits for the library to load so the import can't overwrite saved books.
  useEffect(() => {
    if (!importUri) {
      handledImportUri.current = null;
      return;
    }
    if (!isLoaded || handledImportUri.current === importUri) return;
    handledImportUri.current = importUri;
    router.setParams({ importUri: undefined });

    setImporting(true);
    importBook(importUri)
      .then(openImported)
      .catch((e) =>
        Alert.alert(
          "Couldn't Open Book",
          e?.message || "This file could not be imported.",
        ),
      )
      .finally(() => setImporting(false));
  }, [importUri, isLoaded]);

  const handlePickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      // Some Android file managers label EPUBs as generic binaries; the
      // importer validates the contents either way.
      type:
        Platform.OS === "ios"
          ? ["application/epub+zip"]
          : ["application/epub+zip", "application/octet-stream"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    setImporting(true);
    const imported: SavedBook[] = [];
    const failed: string[] = [];
    for (const asset of result.assets) {
      try {
        imported.push(await importBook(asset.uri, asset.name));
      } catch {
        failed.push(asset.name);
      } finally {
        // The picker's temporary copy is no longer needed.
        const cacheDir = FileSystem.cacheDirectory;
        if (cacheDir && asset.uri.startsWith(cacheDir)) {
          FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(
            () => {},
          );
        }
      }
    }
    setImporting(false);

    if (imported.length === 1 && failed.length === 0) {
      openImported(imported[0]);
    } else if (failed.length) {
      Alert.alert(
        imported.length ? "Some Files Skipped" : "Import Failed",
        `${imported.length ? `Imported ${imported.length} book(s). ` : ""}These files aren't valid EPUBs:\n\n${failed.join("\n")}`,
      );
    } else {
      setFilter("all");
      Alert.alert(
        "Imported",
        `${imported.length} books added to your library.`,
      );
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#050505",
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
      }}
    >
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: "#FFF",
              letterSpacing: 2,
            }}
          >
            MY LIBRARY
          </Text>
          <TouchableOpacity
            onPress={handlePickFiles}
            disabled={importing}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1A1A1A",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#333",
            }}
          >
            <Ionicons name="add" size={16} color="#2DDA93" />
            <Text
              style={{
                color: "#DDD",
                fontSize: 11,
                fontWeight: "bold",
                marginLeft: 4,
              }}
            >
              IMPORT EPUB
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Tabs */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#222",
            borderRadius: 12,
            padding: 4,
            maxWidth: 500,
          }}
        >
          {FILTERS.map(({ key: f, label }) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                borderRadius: 8,
                backgroundColor: filter === f ? "#333" : "transparent",
              }}
            >
              <Text
                style={{
                  color: filter === f ? "#FFF" : "#888",
                  fontWeight: "bold",
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlashList
        data={displayData}
        key={numColumns}
        renderItem={({ item }) => (
          <BookCard item={item} onPress={() => setSelectedBook(item)} />
        )}
        estimatedItemSize={280}
        numColumns={numColumns}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ color: "#444", fontSize: 16 }}>
              No books found in this list.
            </Text>
            {filter === "all" && (
              <Text
                style={{
                  color: "#444",
                  fontSize: 13,
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Tap Import EPUB to add books from your device.
              </Text>
            )}
          </View>
        }
      />

      <DetailsModal
        book={selectedBook}
        visible={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        onRead={handleOpenReader}
        onReadEpub={handleOpenEpub}
      />

      <ReaderModal
        visible={readerVisible}
        book={readerBook}
        localUri={readerUri}
        onClose={() => setReaderVisible(false)}
      />

      <EpubReaderModal
        visible={epubVisible}
        book={activeReaderData?.book}
        epubUri={activeReaderData?.uri}
        onClose={() => {
          setEpubVisible(false);
          setTimeout(() => setActiveReaderData(null), 500);
        }}
      />

      {importing && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator color="#2DDA93" size="large" />
          <Text style={{ color: "#DDD", marginTop: 12, fontWeight: "bold" }}>
            Importing book...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
