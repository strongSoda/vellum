import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';

const { width } = Dimensions.get('window');
const THEME = { background: '#050505', accent: '#2DDA93', text: '#FFF', textMuted: '#888' };

// ... ShineButton Code (Keep exactly as you have it) ...
const ShineButton = ({ onPress, text, disabled, loading, isReadMode, style }: any) => {
  const shineAnim = useRef(new Animated.Value(-100)).current;
  useEffect(() => {
    if (disabled || loading || isReadMode) return;
    const loop = Animated.loop(Animated.timing(shineAnim, { toValue: width, duration: 2000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [disabled, loading, isReadMode]);

  return (
    <TouchableOpacity style={[styles.mainBtn, isReadMode ? styles.readBtn : styles.downloadBtn, disabled && styles.disabledBtn, style]} onPress={onPress} disabled={disabled} activeOpacity={0.9}>
      <View style={{overflow: 'hidden', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
         {!disabled && !loading && !isReadMode && (
            <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 30, backgroundColor: 'rgba(255,255,255,0.4)', transform: [{ translateX: shineAnim }, { skewX: '-20deg' }] }} />
         )}
         {loading ? (
            <View style={{flexDirection:'row', alignItems:'center'}}><ActivityIndicator color="#000" style={{marginRight: 8}}/><Text style={styles.btnText}>DOWNLOADING...</Text></View>
         ) : (
            <Text style={styles.btnText}>{text}</Text>
         )}
      </View>
    </TouchableOpacity>
  );
};

// FIX: Added 'onRead' prop
export const DetailsModal = ({ book, visible, onClose, onRead }: { book: any; visible: boolean; onClose: () => void, onRead: (uri: string) => void }) => {
  const insets = useSafeAreaInsets();
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const { savedBooks, updateStatus, updateNotes, removeBook, saveBook, startDownload, activeDownload } = useLibrary();
  
  const [downloadingCover, setDownloadingCover] = useState(false);
  const [notes, setNotes] = useState('');

  const libraryEntry = book ? savedBooks.find(b => b.id === book.id) : null;
  const isDownloadingThis = activeDownload && activeDownload.id === book?.id;
  const isDownloaded = !!(libraryEntry?.readerUri || libraryEntry?.localUri);

  useEffect(() => {
    if (book && libraryEntry) setNotes(libraryEntry.notes);
    else setNotes('');
  }, [book, libraryEntry]);

  if (!book) return null;

  const coverUrl = book.formats['image/jpeg'];
  const epubUrl = book.formats['application/epub+zip'];
  const authorName = book.authors[0]?.name.split(',').reverse().join(' ').trim() || 'Unknown';
  const authorLife = book.authors[0]?.birth_year ? `${book.authors[0].birth_year} – ${book.authors[0].death_year || '?'}` : '';

  const handleReadInternal = () => {
      if (libraryEntry?.readerUri) {
          // FIX: Close this modal, then trigger parent to open Reader
          onClose();
          setTimeout(() => onRead(libraryEntry.readerUri!), 300);
      } else {
          Alert.alert("Unavailable", "Internal reader format not available.");
      }
  };

  const handleReadExternal = async () => {
      const uri = libraryEntry?.localUri || libraryEntry?.readerUri;
      if (uri) {
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
          else Alert.alert("Error", "Sharing not available.");
      }
  };

  const handleDownloadAction = () => startDownload(book);

  const handleSaveCover = async () => {
    if (!coverUrl) return;
    setDownloadingCover(true);
    try {
      if (!permissionResponse?.granted) {
        const perm = await requestPermission();
        if (!perm.granted) return;
      }
      const file = new File(Paths.cache, `cover_${book.id}.jpg`);
      if (file.exists) file.delete(); 
      await File.downloadFileAsync(coverUrl, file);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      Alert.alert("Success", "Cover art saved.");
    } catch (e) { console.error(e); } finally { setDownloadingCover(false); }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose} presentationStyle="overFullScreen" transparent>
      <View style={styles.container}>
        {coverUrl && <Image source={{ uri: coverUrl }} style={styles.ambientBg} blurRadius={90} />}
        <View style={styles.overlay} />

        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { top: Platform.OS === 'android' ? 40 : insets.top + 10 }]}>
            <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.coverWrapper}>
               <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
            </View>
            
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{authorName}</Text>
            {authorLife ? <Text style={styles.lifeSpan}>{authorLife}</Text> : null}

            {isDownloaded ? (
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.mainBtn, styles.readBtn, {flex: 1, marginRight: 8}]} onPress={handleReadInternal}>
                        <Text style={styles.btnText}>READ NOW</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mainBtn, styles.secondaryActionBtn, {flex: 1}]} onPress={handleReadExternal}>
                        <Text style={[styles.btnText, {color: '#FFF'}]}>OPEN EPUB</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => removeBook(book.id)}>
                        <Ionicons name="bookmark" size={24} color={THEME.accent} />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.actionRow}>
                    <View style={{flex: 1}}>
                        <ShineButton onPress={handleDownloadAction} text="DOWNLOAD BOOK" disabled={!epubUrl || isDownloadingThis} loading={isDownloadingThis} />
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => saveBook(book)}>
                        <Ionicons name="bookmark-outline" size={24} color={THEME.accent} />
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveCover} disabled={downloadingCover}>
                {downloadingCover ? <ActivityIndicator size="small" color={THEME.accent} /> : <Ionicons name="image-outline" size={20} color={THEME.accent} style={{marginRight: 8}} />}
                <Text style={styles.secondaryBtnText}>{downloadingCover ? "Saving..." : "Save Cover Art"}</Text>
            </TouchableOpacity>

            {/* Library/Metadata Sections unchanged... */}
            {libraryEntry && (
                <View style={styles.libraryPanel}>
                    <Text style={styles.sectionHeader}>Reading Progress</Text>
                    <View style={styles.statusRow}>
                        {['toread', 'reading', 'completed'].map((s) => (
                            <TouchableOpacity key={s} onPress={() => updateStatus(book.id, s as any)} style={[styles.statusChip, libraryEntry.status === s && { backgroundColor: THEME.accent }]}>
                                <Text style={[styles.statusText, libraryEntry.status === s && { color: '#000', fontWeight: 'bold' }]}>{s.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TextInput style={styles.notesInput} multiline placeholder="My notes..." placeholderTextColor="#555" value={notes} onChangeText={(t) => { setNotes(t); updateNotes(book.id, t); }} />
                </View>
            )}
            <View style={styles.metaGrid}>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>DOWNLOADS</Text><Text style={styles.metaValue}>{book.download_count.toLocaleString()}</Text></View>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>LANGUAGE</Text><Text style={styles.metaValue}>{book.languages[0]?.toUpperCase()}</Text></View>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>COPYRIGHT</Text><Text style={styles.metaValue}>{book.copyright ? "YES" : "NO"}</Text></View>
                <View style={styles.metaItem}><Text style={styles.metaLabel}>TYPE</Text><Text style={styles.metaValue}>{book.media_type}</Text></View>
            </View>
            <Text style={styles.desc}>{book.summaries?.[0] || "No summary available."}</Text>
            <View style={styles.tagRow}>
                {[...(book.subjects || []), ...(book.bookshelves || [])].slice(0, 8).map((s: string, i: number) => (
                    <View key={i} style={styles.tag}><Text style={styles.tagText}>{s.replace('Category: ', '').split(' -- ')[0]}</Text></View>
                ))}
            </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ... (Styles unchanged from previous version) ...
  container: { flex: 1, backgroundColor: THEME.background },
  ambientBg: { ...StyleSheet.absoluteFillObject, opacity: 0.7 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: 0.88 },
  closeBtn: { position: 'absolute', right: 20, zIndex: 50, backgroundColor: 'rgba(50,50,50,0.8)', padding: 10, borderRadius: 25 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 80, alignItems: 'center' },
  coverWrapper: { shadowColor: THEME.accent, shadowOffset: {width:0, height:0}, shadowOpacity: 0.3, shadowRadius: 40, elevation: 15, marginBottom: 24 },
  cover: { width: width * 0.45, height: (width * 0.45) * 1.5, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  title: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 6, letterSpacing: 0.5 },
  author: { fontSize: 16, color: '#CCC', textAlign: 'center', marginBottom: 4 },
  lifeSpan: { fontSize: 13, color: '#666', marginBottom: 24, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', width: '100%', gap: 12, marginBottom: 16 },
  mainBtn: { height: 56, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  downloadBtn: { backgroundColor: THEME.accent },
  readBtn: { backgroundColor: '#FFF' },
  secondaryActionBtn: { backgroundColor: '#222', borderWidth: 1, borderColor: '#444' },
  disabledBtn: { backgroundColor: '#333' },
  btnText: { fontWeight: '900', fontSize: 13, letterSpacing: 1, color: '#000' },
  iconBtn: { width: 56, height: 56, backgroundColor: '#1A1A1A', borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  secondaryBtn: { flexDirection: 'row', width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center', marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.02)' },
  secondaryBtnText: { color: THEME.accent, fontWeight: '700', fontSize: 14 },
  libraryPanel: { width: '100%', backgroundColor: '#111', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#222' },
  sectionHeader: { color: '#888', fontSize: 11, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statusChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333', backgroundColor: '#000' },
  statusText: { color: '#888', fontSize: 11, fontWeight: '600' },
  notesInput: { backgroundColor: '#000', color: '#FFF', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#333' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 },
  metaItem: { width: '50%', marginBottom: 12, alignItems: 'center' },
  metaLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  metaValue: { color: '#EEE', fontSize: 13, fontWeight: '600' },
  desc: { color: '#BBB', lineHeight: 24, fontSize: 15, marginBottom: 30, textAlign: 'left', width: '100%' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  tag: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  tagText: { color: '#999', fontSize: 11, fontWeight: '600' }
});
