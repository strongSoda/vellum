import { useLibrary } from '@/context/LibraryContext';
import { useLegacyFileSystem } from '@/hooks/useLegacyFileSystem';
import { downloadDictionary, getLocalDefinition } from '@/utils/Dictionary';
import { ReaderProvider, useReader } from '@epubjs-react-native/core';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MemoizedReader } from './MemoReader';
import { ReaderPopup } from './ReaderPopup';

// IMPORT DICTIONARY
// Note: You need to create this file in assets/ or download one
// import dictionaryData from '../assets/dictionary.json'; 

const ReaderControls = () => {
  const { 
    changeFontSize, 
    addBookmark, 
    getCurrentLocation 
  } = useReader();

  const handleBookmark = () => {
    const location = getCurrentLocation();
    if (location) {
        addBookmark(location.start.cfi);
        Alert.alert("Success", "Page bookmarked");
    }
  };

  return (
    <View style={styles.toolbar}>
      <TouchableOpacity onPress={() => changeFontSize('115%')} style={styles.toolBtn}>
        <Ionicons name="add" size={22} color="#FFF" />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => changeFontSize('85%')} style={styles.toolBtn}>
        <Ionicons name="remove" size={22} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity onPress={handleBookmark} style={styles.toolBtn}>
        <Ionicons name="bookmark-outline" size={22} color="#2DDA93" />
      </TouchableOpacity>
    </View>
  );
};

export const EpubReaderModal = ({ visible, book, onClose, epubUri }: any) => {
  const [isReady, setIsReady] = useState(false);
  const fs = useLegacyFileSystem();
  const [popupData, setPopupData] = useState<any>(null);
  const { updateNotes, savedBooks } = useLibrary();

  useEffect(() => {
    if (visible && epubUri) {
      const timer = setTimeout(() => setIsReady(true), 400);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [visible, epubUri]);

  if (!visible || !book || !epubUri) return null;

  const formattedUri = epubUri.startsWith('file://') ? epubUri : `file://${epubUri}`;

  const handleWordLookup = async (text: string) => {
  const cleanWord = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  const result = await getLocalDefinition(cleanWord);

  console.log('result', result);
  

  if (result === 'NOT_DOWNLOADED') {
    Alert.alert(
      "Offline Dictionary",
      "Would you like to download the offline dictionary (8MB) for instant word lookups?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Download", 
          onPress: () => {
            Alert.alert("Downloading", "The dictionary is being saved. You can try lookup again in a moment.");
            downloadDictionary((p) => console.log(`Progress: ${p}`));
          }
        }
      ]
    );
  } else if (result === 'NOT_FOUND' || result === 'ERROR') {
    Alert.alert(cleanWord.toUpperCase(), "Definition not found in local dictionary.", [
      { text: "Search Online", onPress: () => Linking.openURL(`https://www.google.com/search?q=define+${cleanWord}`) },
      { text: "OK" }
    ]);
  } else {
    Alert.alert(cleanWord.toUpperCase(), result);
  }
};

const handleSelection = React.useCallback(async (text: string, cfi: string) => {
    const cleanText = text.trim();
    const words = cleanText.split(/\s+/);

    if (words.length > 1) {
      // It's a snippet
      setPopupData({ type: 'snippet', content: cleanText, cfi });
    } else {
      // It's a single word
      const word = cleanText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const definition = await getLocalDefinition(word);

      if (definition === 'NOT_DOWNLOADED') {
        setPopupData({ type: 'prompt_download', word, content: 'Dictionary not downloaded.' });
      } else if (definition === 'NOT_FOUND') {
        setPopupData({ type: 'definition', word, content: 'No local definition found. Try online search.' });
      } else {
        setPopupData({ type: 'definition', word, content: definition });
      }
    }
  }, []);

  const saveSnippet = (text: string) => {
    const existing = savedBooks.find(b => b.id === book.id);
    const newNote = existing?.notes 
      ? `${existing.notes}\n\nSnippet: "${text}"` 
      : `Snippet: "${text}"`;
    
    updateNotes(book.id, newNote);
    Alert.alert("Saved", "Snippet added to your book notes.");
    setPopupData(null);
  };

  return (
  <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
    <ReaderProvider key={`reader-context-${book.id}`}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.readerContainer}>
          {isReady ? (
            <MemoizedReader
              src={formattedUri}
              fileSystem={() => fs}
              onSelected={handleSelection}
              defaultTheme={{
                'body': { 'background': '#050505', 'color': '#CCC', 'font-family': 'Georgia, serif' }
              }}
            />
          ) : (
            <View style={styles.center}><ActivityIndicator color="#2DDA93" size="large" /></View>
          )}
        </View>

        {/* This bar stays pinned to the bottom */}
        {isReady && <ReaderControls />} 

        <ReaderPopup 
            data={popupData}
            onClose={() => setPopupData(null)}
            onSave={saveSnippet}
            onDownload={async () => {
              setPopupData(null);
              Alert.alert("Downloading", "Please wait a moment...");
              await downloadDictionary((p) => console.log(`Progress: ${p}`));
            }}
          />
      </SafeAreaView>
    </ReaderProvider>
  </Modal>
);
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222', 
    backgroundColor: '#050505' 
  },
  headerTitle: { color: '#FFF', flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { padding: 5 },
  readerContainer: { flex: 1, backgroundColor: '#050505' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Toolbar Styles
  toolbar: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    paddingVertical: 15, 
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#222'
  },
  toolBtn: { alignItems: 'center', paddingHorizontal: 20 },
  toolText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 }
});
