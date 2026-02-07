import { ReaderProvider, useReader } from '@epubjs-react-native/core';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLibrary } from '@/context/LibraryContext';
import { useLegacyFileSystem } from '@/hooks/useLegacyFileSystem';
import { downloadDictionary, getLocalDefinition } from '@/utils/Dictionary';
import { MemoizedReader } from './MemoReader';
import { ReaderPopup } from './ReaderPopup';

const { width } = Dimensions.get('window');

/**
 * ReaderEngine remains the logic hub.
 * We pass bookId explicitly as a prop to isolate it.
 */
const ReaderEngine = ({ epubUri, fs, initialLocation, handleSelection, settings, bookId, setProgress }: any) => {
  const { updateLocation } = useLibrary();
  const { goToLocation, changeFontFamily, currentLocation } = useReader();
  const hasJumped = useRef(false);

  useEffect(() => {
    if (settings.font) changeFontFamily(settings.font);
  }, [settings.font, changeFontFamily]);

  const handleLocationsReady = useCallback(() => {
    if (initialLocation && !hasJumped.current) {
      goToLocation(initialLocation);
      hasJumped.current = true;
    }
  }, [initialLocation, goToLocation]);

  useEffect(() => {
    if (currentLocation?.start?.cfi && bookId) {
      updateLocation(bookId, currentLocation.start.cfi);
      setProgress({
        percent: currentLocation.start.percentage || 0,
        cfi: currentLocation.start.cfi
      });
    }
  }, [currentLocation, bookId]);

  return (
    <MemoizedReader
      src={epubUri}
      fileSystem={() => fs}
      onSelected={handleSelection}
      onLocationsReady={handleLocationsReady}
      defaultTheme={{
        'body': { 
          'background': '#050505 !important', 
          'color': '#CCCCCC !important', 
          'font-family': `${settings.font} !important` 
        }
      }}
    />
  );
};

export const EpubReaderModal = ({ visible, book, onClose, epubUri }: any) => {
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, cfi: '' });
  const [popupData, setPopupData] = useState<any>(null);
  const [settings, setSettings] = useState({ font: 'Georgia, serif' });
  
  const fs = useLegacyFileSystem();
  const { savedBooks, updateNotes } = useLibrary();

  // 1. ALL HOOKS AT THE TOP
  useEffect(() => {
    if (visible && epubUri) {
      const timer = setTimeout(() => setIsReady(true), 600);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [visible, epubUri]);

  const handleSelection = useCallback(async (text: string, cfi: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const words = cleanText.split(/\s+/);
    if (words.length > 1) {
      setPopupData({ type: 'snippet', content: cleanText, cfi });
    } else {
      const word = cleanText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const definition = await getLocalDefinition(word);
      setPopupData({ 
        type: definition === 'NOT_DOWNLOADED' ? 'prompt_download' : 'definition', 
        word, 
        content: definition === 'NOT_DOWNLOADED' ? 'Dictionary needed' : (definition || 'Not found') 
      });
    }
  }, []);

  // 2. Wrap book-dependent logic in useMemo with safety checks
  const savedCfi = useMemo(() => {
    if (!book?.id) return undefined;
    const entry = savedBooks.find(b => b.id === book.id);
    return entry?.lastLocation;
  }, [book?.id, savedBooks]);

  const handleSaveSnippet = (text: string) => {
    if (!book?.id) return;
    const existing = savedBooks.find(b => b.id === book.id);
    const newNote = existing?.notes ? `${existing.notes}\n\nSnippet: "${text}"` : `Snippet: "${text}"`;
    updateNotes(book.id, newNote);
    setPopupData(null);
    Alert.alert("Saved", "Snippet added to your book notes.");
  };

  // 3. FINAL GUARD (React allows this if no hooks follow it)
  if (!visible || !book || !epubUri) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <ReaderProvider key="stable-epub-context">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
            <Text style={styles.progressText}>{Math.round(progress.percent * 100)}%</Text>
          </View>

          <View style={styles.readerContainer}>
            {isReady ? (
              <ReaderEngine 
                epubUri={epubUri}
                fs={fs}
                initialLocation={savedCfi}
                handleSelection={handleSelection}
                settings={settings}
                bookId={book.id}
                setProgress={setProgress}
              />
            ) : (
              <View style={styles.center}><ActivityIndicator color="#2DDA93" size="large" /></View>
            )}
          </View>

          {isReady && (
            <View style={styles.footer}>
              <View style={styles.themeRow}>
                <TouchableOpacity onPress={() => setSettings({font: 'Georgia, serif'})} style={styles.themeBtn}>
                  <Text style={[styles.themeBtnText, settings.font.includes('Georgia') && {color: '#2DDA93'}]}>SERIF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSettings({font: 'system-ui'})} style={styles.themeBtn}>
                  <Text style={[styles.toolText, settings.font.includes('system') && {color: '#2DDA93'}]}>SANS</Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                <InternalFontSizers />
              </View>
              <InternalScrubber progress={progress} />
            </View>
          )}

          <ReaderPopup 
            data={popupData} 
            onClose={() => setPopupData(null)} 
            onSave={handleSaveSnippet} 
            onDownload={() => {
              downloadDictionary(() => {});
              setPopupData(null);
            }} 
          />
        </SafeAreaView>
      </ReaderProvider>
    </Modal>
  );
};

// Sub-components to keep useReader hooks isolated
const InternalFontSizers = () => {
  const { changeFontSize } = useReader();
  return (
    <View style={{flexDirection: 'row', gap: 20}}>
      <TouchableOpacity onPress={() => changeFontSize('115%')}><Ionicons name="add" size={22} color="#FFF" /></TouchableOpacity>
      <TouchableOpacity onPress={() => changeFontSize('85%')}><Ionicons name="remove" size={22} color="#FFF" /></TouchableOpacity>
    </View>
  );
};

const InternalScrubber = ({ progress }: any) => {
  const { goToLocation } = useReader();
  return (
    <Slider
      style={styles.slider}
      minimumValue={0}
      maximumValue={1}
      value={progress.percent}
      minimumTrackTintColor="#2DDA93"
      maximumTrackTintColor="#333"
      thumbTintColor="#2DDA93"
      onSlidingComplete={(val) => goToLocation(val)} // Slider percentage jump
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#FFF', flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 13, marginHorizontal: 10 },
  progressText: { color: '#2DDA93', fontSize: 11, fontWeight: 'bold' },
  readerContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#222', paddingBottom: 20 },
  themeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, gap: 15 },
  themeBtn: { paddingHorizontal: 12 },
  themeBtnText: { color: '#666', fontSize: 11, fontWeight: 'bold' },
  toolText: { color: '#666', fontSize: 11, fontWeight: 'bold' },
  divider: { width: 1, height: 20, backgroundColor: '#333' },
  slider: { width: width - 40, alignSelf: 'center', height: 40 }
});