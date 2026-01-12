import { EpubReaderModal } from '@/components/EpubReader';
import { UpdateBanner } from '@/components/UpdateBanner';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, StatusBar, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCard } from '../../components/BookCard';
import { DetailsModal } from '../../components/DetailsModal';
import { FloatingDownloadBar } from '../../components/FloatingDownloadBar';
import { ReaderModal } from '../../components/Reader'; // Import the fixed Reader
import { STATIC_BOOKS } from '../../constants/StaticBooks';
import { useLibrary } from '../../context/LibraryContext';

export default function HomeScreen() {
  const { activeDownload } = useLibrary();
  const { width } = useWindowDimensions();
  const numColumns = Math.max(2, Math.floor(width / 170));

  const [books, setBooks] = useState<any[]>(STATIC_BOOKS); 
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  
  // --- Reader State (Root Level) ---
  const [readerVisible, setReaderVisible] = useState(false);
  const [readerUri, setReaderUri] = useState<string | null>(null);
  const [readerBook, setReaderBook] = useState<any>(null);

  const [epubVisible, setEpubVisible] = useState(false);
  const [epubUri, setEpubUri] = useState<string | null>(null);
  const [activeReaderData, setActiveReaderData] = useState<{book: any, uri: string} | null>(null);

  const [search, setSearch] = useState('');
  const [activeSort, setActiveSort] = useState<'popular' | 'alphabetical' | 'new'>('popular');

  const handleOpenEpub = (uri: string) => {
    // 1. Capture the data immediately
    setActiveReaderData({ book: selectedBook, uri });
    
    // 2. Close the Details Modal first
    setSelectedBook(null);

    // 3. CRITICAL: Wait for DetailsModal to finish its closing animation 
    // before asking UIKit to present the next modal.
    setTimeout(() => {
      setEpubVisible(true);
    }, 600); // 600ms is the safe window for iOS modal transitions
  };

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

  // --- Handler passed to DetailsModal ---
  const handleOpenReader = (uri: string) => {
      setReaderUri(uri);
      setReaderBook(selectedBook);
      setReaderVisible(true);
  };

  const getSortLabel = () => {
      switch (activeSort) {
          case 'popular': return 'POPULAR';
          case 'alphabetical': return 'A - Z';
          case 'new': return 'NEWEST';
          default: return 'SORT';
      }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050505', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle="light-content" />
      <UpdateBanner />
      
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12}}>
            <View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: 2 }}>VELLUM</Text>
                <Text style={{ color: '#2DDA93', fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 }}>OFFLINE LIBRARY</Text>
            </View>
            
            <TouchableOpacity onPress={toggleSort} style={{flexDirection:'row', alignItems:'center', backgroundColor:'#1A1A1A', paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:'#333'}}>
                <Text style={{color: '#DDD', fontSize: 11, fontWeight:'bold', marginRight: 6}}>
                    {getSortLabel()}
                </Text>
                <Ionicons name="filter" size={14} color="#2DDA93" />
            </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', backgroundColor: '#161616', borderRadius: 12, height: 46, alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#222' }}>
          <Ionicons name="search" size={18} color="#666" />
          <TextInput 
            style={{ flex: 1, color: '#FFF', marginLeft: 10, fontSize: 15 }}
            placeholder="Search title or author..." 
            placeholderTextColor="#555"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                  <Ionicons name="close-circle" size={18} color="#666" />
              </TouchableOpacity>
          )}
        </View>
      </View>

      <FlashList
        data={books}
        key={numColumns}
        numColumns={numColumns}
        renderItem={({ item }) => <BookCard item={item} onPress={() => handleBookPress(item)} />}
        estimatedItemSize={280}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2DDA93" colors={['#2DDA93']} progressBackgroundColor="#111" />
        }
        ListEmptyComponent={
            <View style={{alignItems:'center', marginTop: 50}}>
                <Text style={{color:'#444'}}>No books found.</Text>
            </View>
        }
      />

      {/* --- MODALS ARE NOW SIBLINGS --- */}
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
        // Use the persistent reader data instead of selectedBook
        book={activeReaderData?.book} 
        epubUri={activeReaderData?.uri} 
        onClose={() => {
          setEpubVisible(false);
          // Wait for reader to slide down before wiping data
          setTimeout(() => setActiveReaderData(null), 500);
        }} 
      />

      <FloatingDownloadBar onPress={() => activeDownload && setSelectedBook(activeDownload)} />

    </SafeAreaView>
  );
}
