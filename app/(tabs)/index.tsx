import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, SafeAreaView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BookCard } from '../../components/BookCard';
import { DetailsModal } from '../../components/DetailsModal';
import { FloatingDownloadBar } from '../../components/FloatingDownloadBar';
import { STATIC_BOOKS } from '../../constants/StaticBooks';
import { useLibrary } from '../../context/LibraryContext';

export default function HomeScreen() {
  const { activeDownload } = useLibrary();
  
  // Data State
  const [books, setBooks] = useState<any[]>(STATIC_BOOKS); 
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);

  // Filter State
  const [search, setSearch] = useState('');
  // Added 'new' to the sort state type
  const [activeSort, setActiveSort] = useState<'popular' | 'alphabetical' | 'new'>('popular');

  // --- Filter & Sort Logic ---
  useEffect(() => {
    // Always start with a fresh copy of the master list
    let result = [...STATIC_BOOKS];

    // 1. Local Search
    if (search.trim().length > 0) {
        const q = search.toLowerCase();
        result = result.filter(b => 
            b.title.toLowerCase().includes(q) || 
            b.authors.some((a: any) => a.name.toLowerCase().includes(q))
        );
    }

    // 2. Sorting
    if (activeSort === 'popular') {
        // Sort by download count (High to Low)
        result.sort((a, b) => b.download_count - a.download_count);
    } else if (activeSort === 'alphabetical') {
        // Sort by Title (A to Z)
        result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (activeSort === 'new') {
        // "New" = Reverse the order of the saved JSON (Show bottom items first)
        result.reverse();
    }

    setBooks(result);
  }, [search, activeSort]);

  // --- Actions ---

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
        setSearch('');
        setActiveSort('popular');
        setRefreshing(false);
    }, 800);
  }, []);

  // Cycle: Popular -> A-Z -> New -> Popular
  const toggleSort = () => {
      setActiveSort(prev => {
          if (prev === 'popular') return 'alphabetical';
          if (prev === 'alphabetical') return 'new';
          return 'popular';
      });
  };

  const handleBookPress = async (item: any) => {
      setSelectedBook(item);
      // Silent refresh of details if online
      try {
          const res = await fetch(`https://gutendex.com/books/${item.id}`);
          const freshData = await res.json();
          if (freshData.id) setSelectedBook(freshData);
      } catch (e) { /* Ignore */ }
  };

  // Helper for Icon display
  const getSortIcon = () => {
      switch (activeSort) {
          case 'popular': return 'flame';
          case 'alphabetical': return 'text';
          case 'new': return 'time';
          default: return 'filter';
      }
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
      
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 12}}>
            <View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: 2 }}>VELLUM</Text>
                <Text style={{ color: '#2DDA93', fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 }}>OFFLINE LIBRARY</Text>
            </View>
            
            {/* Sort Button */}
            <TouchableOpacity onPress={toggleSort} style={{flexDirection:'row', alignItems:'center', backgroundColor:'#1A1A1A', paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:'#333'}}>
                <Text style={{color: '#DDD', fontSize: 11, fontWeight:'bold', marginRight: 6}}>
                    {getSortLabel()}
                </Text>
                <Ionicons name={getSortIcon() as any} size={14} color="#2DDA93" />
            </TouchableOpacity>
        </View>

        {/* Search Bar */}
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

      {/* Book List */}
      <FlashList
        data={books}
        renderItem={({ item }) => <BookCard item={item} onPress={() => handleBookPress(item)} />}
        estimatedItemSize={280}
        numColumns={2}
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

      {/* Modals */}
      <DetailsModal book={selectedBook} visible={!!selectedBook} onClose={() => setSelectedBook(null)} />
      <FloatingDownloadBar onPress={() => activeDownload && setSelectedBook(activeDownload)} />

    </SafeAreaView>
  );
}
