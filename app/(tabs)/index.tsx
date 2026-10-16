import { BookViewer } from '@/components/BookViewer';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useAppTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, StatusBar, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCard } from '../../components/BookCard';
import { FloatingDownloadBar } from '../../components/FloatingDownloadBar';
import { STATIC_BOOKS } from '../../constants/StaticBooks';
import { useLibrary } from '../../context/LibraryContext';

export default function HomeScreen() {
  const { activeDownload } = useLibrary();
  const { colors, scheme, toggleScheme } = useAppTheme();
  const { width } = useWindowDimensions();
  const numColumns = Math.max(2, Math.floor(width / 170));

  const [books, setBooks] = useState<any[]>(STATIC_BOOKS);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [activeSort, setActiveSort] = useState<'popular' | 'alphabetical' | 'new'>('popular');

  useEffect(() => {
    let result = [...STATIC_BOOKS];
    if (search.trim().length > 0) {
        const q = search.toLowerCase();
        result = result.filter(b =>
            b.title.toLowerCase().includes(q) ||
            b.authors.some((a: any) => a.name.toLowerCase().includes(q))
        );
    }
    if (activeSort === 'popular') {
        result.sort((a, b) => b.download_count - a.download_count);
    } else if (activeSort === 'alphabetical') {
        result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (activeSort === 'new') {
        result.reverse();
    }
    setBooks(result);
  }, [search, activeSort]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
        setSearch('');
        setActiveSort('popular');
        setRefreshing(false);
    }, 800);
  }, []);

  const toggleSort = () => {
      setActiveSort(prev => {
          if (prev === 'popular') return 'alphabetical';
          if (prev === 'alphabetical') return 'new';
          return 'popular';
      });
  };

  const handleBookPress = async (item: any) => {
      setSelectedBook(item);
      try {
          const res = await fetch(`https://gutendex.com/books/${item.id}`);
          const freshData = await res.json();
          if (freshData.id) setSelectedBook(freshData);
      } catch (e) { /* Ignore */ }
  };

  const getSortLabel = () => {
      switch (activeSort) {
          case 'popular': return 'POPULAR';
          case 'alphabetical': return 'A - Z';
          case 'new': return 'NEWEST';
          default: return 'SORT';
      }
  };

  const pillStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.borderStrong };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <UpdateBanner />

      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12}}>
            <View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: 2 }}>VELLUM</Text>
                <Text style={{ color: colors.accentText, fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 }}>OFFLINE LIBRARY</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                    onPress={toggleScheme}
                    style={[pillStyle, { paddingHorizontal: 9 }]}
                    accessibilityLabel={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    <Ionicons name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.accentText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleSort} style={pillStyle}>
                    <Text style={{color: colors.textSecondary, fontSize: 11, fontWeight:'bold', marginRight: 6}}>
                        {getSortLabel()}
                    </Text>
                    <Ionicons name="filter" size={14} color={colors.accentText} />
                </TouchableOpacity>
            </View>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, height: 46, alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={{ flex: 1, color: colors.text, marginLeft: 10, fontSize: 15 }}
            placeholder="Search title or author..."
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
          )}
        </View>
      </View>

      <FlashList
        data={books}
        key={numColumns}
        numColumns={numColumns}
        renderItem={({ item }) => <BookCard item={item} onPress={() => handleBookPress(item)} />}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentText} colors={[colors.accentText]} progressBackgroundColor={colors.surface} />
        }
        ListEmptyComponent={
            <View style={{alignItems:'center', marginTop: 50}}>
                <Text style={{color: colors.textFaint}}>No books found.</Text>
            </View>
        }
      />

      <BookViewer book={selectedBook} onClose={() => setSelectedBook(null)} />

      <FloatingDownloadBar onPress={() => activeDownload && setSelectedBook(activeDownload)} />

    </SafeAreaView>
  );
}
