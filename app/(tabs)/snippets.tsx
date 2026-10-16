import { BookViewer } from "@/components/BookViewer";
import { AppPalette } from "@/constants/theme";
import { Snippet, useLibrary } from "@/context/LibraryContext";
import { useAppTheme, useThemedStyles } from "@/context/ThemeContext";
import { formatAuthor } from "@/utils/BookFormat";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  SectionList,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Grouping = "recent" | "book" | "author";
const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: "recent", label: "RECENT" },
  { key: "book", label: "BY BOOK" },
  { key: "author", label: "BY AUTHOR" },
];

type SnippetItem = Snippet & {
  bookId: number;
  book: any;
  title: string;
  author: string;
};

export default function SnippetsScreen() {
  const { savedBooks, removeSnippet } = useLibrary();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [grouping, setGrouping] = useState<Grouping>("recent");
  const [search, setSearch] = useState("");
  const [selectedBook, setSelectedBook] = useState<any>(null);

  const allSnippets = useMemo<SnippetItem[]>(
    () =>
      savedBooks
        .flatMap((sb) =>
          (sb.snippets || []).map((s) => ({
            ...s,
            bookId: sb.id,
            book: sb.book,
            title: sb.book?.title || "Untitled",
            author: formatAuthor(sb.book),
          })),
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [savedBooks],
  );

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allSnippets.filter(
          (s) =>
            s.text.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q) ||
            s.author.toLowerCase().includes(q),
        )
      : allSnippets;

    if (grouping === "recent") return filtered.length ? [{ key: "all", title: "", data: filtered }] : [];

    // Group while keeping the newest-first order inside and between groups.
    const groups = new Map<string, { key: string; title: string; data: SnippetItem[] }>();
    filtered.forEach((s) => {
      const key = grouping === "book" ? String(s.bookId) : s.author;
      const title = grouping === "book" ? `${s.title} · ${s.author}` : s.author;
      if (!groups.has(key)) groups.set(key, { key, title, data: [] });
      groups.get(key)!.data.push(s);
    });
    return [...groups.values()];
  }, [allSnippets, grouping, search]);

  const confirmDelete = (s: SnippetItem) => {
    Alert.alert("Delete Snippet", "Remove this snippet from your collection?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeSnippet(s.bookId, s.id) },
    ]);
  };

  const shareSnippet = (s: SnippetItem) => {
    Share.share({ message: `“${s.text}”\n\n— ${s.author}, ${s.title}` }).catch(() => {});
  };

  const renderItem = ({ item }: { item: SnippetItem }) => (
    <View style={styles.card}>
      <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.accentText} style={styles.quoteIcon} />
      <Text style={styles.quote} selectable>
        “{item.text}”
      </Text>

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setSelectedBook(item.book)}
          accessibilityLabel={`Open ${item.title}`}
        >
          <Text style={styles.bookTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {item.author} · {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => shareSnippet(item)} style={styles.iconBtn} hitSlop={6} accessibilityLabel="Share snippet">
          <Ionicons name="share-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.iconBtn} hitSlop={6} accessibilityLabel="Delete snippet">
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.headerTitle}>SNIPPETS</Text>
          {allSnippets.length > 0 && (
            <Text style={styles.count}>
              {allSnippets.length} saved
            </Text>
          )}
        </View>

        {allSnippets.length > 0 && (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search snippets, books, authors..."
                placeholderTextColor={colors.textFaint}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.segment}>
              {GROUPINGS.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  onPress={() => setGrouping(g.key)}
                  style={[styles.segmentItem, grouping === g.key && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, grouping === g.key && styles.segmentTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={styles.sectionHeader} numberOfLines={1}>{section.title}</Text> : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmarks-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>
              {allSnippets.length ? "No matching snippets" : "No snippets yet"}
            </Text>
            {!allSnippets.length && (
              <Text style={styles.emptyText}>
                While reading, select a passage and tap “Save Snippet”. Your snippets from every book will
                collect here.
              </Text>
            )}
          </View>
        }
      />

      <BookViewer book={selectedBook} onClose={() => setSelectedBook(null)} />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    },
    header: { padding: 16, paddingBottom: 4 },
    titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 },
    headerTitle: { fontSize: 28, fontWeight: "900", color: c.text, letterSpacing: 2 },
    count: { color: c.accentText, fontSize: 12, fontWeight: "bold", letterSpacing: 1 },
    searchBox: {
      flexDirection: "row",
      backgroundColor: c.surface,
      borderRadius: 12,
      height: 46,
      alignItems: "center",
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
    },
    searchInput: { flex: 1, color: c.text, marginLeft: 10, fontSize: 15 },
    segment: { flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 4, maxWidth: 500 },
    segmentItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
    segmentItemActive: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong },
    segmentText: { color: c.textMuted, fontWeight: "bold", fontSize: 11 },
    segmentTextActive: { color: c.text },
    list: { padding: 16, paddingBottom: 60, maxWidth: 760, width: "100%", alignSelf: "center" },
    sectionHeader: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginTop: 12,
      marginBottom: 10,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 12,
    },
    quoteIcon: { marginBottom: 8 },
    quote: {
      color: c.text,
      fontSize: 16,
      lineHeight: 25,
      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: 4,
    },
    bookTitle: { color: c.accentText, fontSize: 13, fontWeight: "700" },
    bookAuthor: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    iconBtn: { padding: 8 },
    empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 10 },
    emptyTitle: { color: c.textSecondary, fontSize: 16, fontWeight: "700" },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  });
