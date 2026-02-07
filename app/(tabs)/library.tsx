import { EpubReaderModal } from "@/components/EpubReader";
import { ReaderModal } from "@/components/Reader";
import { FlashList } from "@shopify/flash-list";
import React, { useState } from "react";
import {
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
import { useLibrary } from "../../context/LibraryContext";

export default function LibraryScreen() {
  const { savedBooks } = useLibrary();
  const [filter, setFilter] = useState<"all" | "reading" | "completed">("all");
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

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#050505",
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
      }}
    >
      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: "#FFF",
            letterSpacing: 2,
            marginBottom: 16,
          }}
        >
          MY LIBRARY
        </Text>

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
          {["all", "reading", "completed"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
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
                {f.toUpperCase()}
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
    </SafeAreaView>
  );
}
