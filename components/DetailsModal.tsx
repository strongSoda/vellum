import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Easing, Image, Modal,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
  View, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';

const THEME = { background: '#050505', accent: '#2DDA93', text: '#FFF', textMuted: '#888' };
const MAX_CONTENT_WIDTH = 650;

const ShineButton = ({ onPress, text, disabled, loading, style }: any) => {
  const { width: windowWidth } = useWindowDimensions();
  const shineAnim = useRef(new Animated.Value(-100)).current;
  
  useEffect(() => {
    if (disabled || loading) return;
    const loop = Animated.loop(Animated.timing(shineAnim, { 
        toValue: windowWidth, 
        duration: 2000, 
        easing: Easing.linear, 
        useNativeDriver: true 
    }));
    loop.start();
    return () => loop.stop();
  }, [disabled, loading, windowWidth]);

  return (
    <TouchableOpacity style={[styles.mainBtn, styles.downloadBtn, disabled && styles.disabledBtn, style]} onPress={onPress} disabled={disabled} activeOpacity={0.9}>
      <View style={{overflow: 'hidden', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
         {!disabled && !loading && (
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

export const DetailsModal = ({ book, visible, onClose, onRead, onReadEpub }: any) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const { savedBooks, updateStatus, updateNotes, removeBook, saveBook, startDownload, activeDownload } = useLibrary();
  
  const [downloadingCover, setDownloadingCover] = useState(false);
  const [notes, setNotes] = useState('');

  const isTablet = windowWidth >= 768;
  const coverSize = useMemo(() => {
    const size = isTablet ? 240 : windowWidth * 0.45;
    return { width: size, height: size * 1.5 };
  }, [windowWidth, isTablet]);

  const libraryEntry = book ? savedBooks.find(b => b.id === book.id) : null;
  const isDownloadingThis = activeDownload && activeDownload.id === book?.id;
  const isDownloaded = !!(libraryEntry?.readerUri || libraryEntry?.localUri);

  useEffect(() => {
    if (book && libraryEntry) setNotes(libraryEntry.notes);
    else setNotes('');
  }, [book, libraryEntry]);

  if (!book) return null;

  const coverUrl = book.formats['image/jpeg'];
  const authorName = book.authors[0]?.name.split(',').reverse().join(' ').trim() || 'Unknown';

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
    if (uri && await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  };

  const handleManageBook = () => {
    Alert.alert(
      "Manage Book",
      "Choose an action for this book.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Redownload (Repair)", onPress: () => startDownload(book) },
        { text: "Delete from Device", style: "destructive", onPress: () => removeBook(book.id) }
      ]
    );
  };

  return (
    <Modal animationType="fade" visible={visible} onRequestClose={onClose} transparent>
      <View style={styles.container}>
        {coverUrl && <Image source={{ uri: coverUrl }} style={styles.ambientBg} blurRadius={90} />}
        <View style={styles.overlay} />

        <View style={styles.responsiveWrapper}>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { top: insets.top + 10 }]}>
                <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.coverWrapper, { width: coverSize.width, height: coverSize.height }]}>
                   <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
                </View>
                
                <Text style={styles.title}>{book.title}</Text>
                <Text style={styles.author}>{authorName}</Text>

                <View style={styles.actionRow}>
                    {isDownloaded ? (
                        <>
                            <TouchableOpacity style={[styles.mainBtn, styles.readBtn, { flex: 1.5 }]} onPress={handleReadChoice}>
                                <Text style={styles.btnText}>READ BOOK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.mainBtn, styles.secondaryActionBtn, { flex: 1 }]} onPress={handleExport}>
                                <Text style={[styles.btnText, { color: '#FFF' }]}>EXPORT</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={handleManageBook}>
                                <Ionicons name="ellipsis-vertical" size={22} color={THEME.accent} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={{flex: 1}}>
                                <ShineButton onPress={() => startDownload(book)} text="DOWNLOAD" disabled={isDownloadingThis} loading={isDownloadingThis} />
                            </View>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => saveBook(book)}>
                                <Ionicons name={libraryEntry ? "bookmark" : "bookmark-outline"} size={24} color={THEME.accent} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => {/* existing cover save logic */}}>
                    <Ionicons name="image-outline" size={20} color={THEME.accent} style={{marginRight: 8}} />
                    <Text style={styles.secondaryBtnText}>Save Cover Art</Text>
                </TouchableOpacity>

                {libraryEntry && (
                    <View style={styles.libraryPanel}>
                        <Text style={styles.sectionHeader}>Library Progress</Text>
                        <View style={styles.statusRow}>
                            {['toread', 'reading', 'completed'].map((s) => (
                                <TouchableOpacity key={s} onPress={() => updateStatus(book.id, s as any)} style={[styles.statusChip, libraryEntry.status === s && { backgroundColor: THEME.accent }]}>
                                    <Text style={[styles.statusText, libraryEntry.status === s && { color: '#000' }]}>{s.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput style={styles.notesInput} multiline placeholder="Personal notes..." placeholderTextColor="#444" value={notes} onChangeText={(t) => { setNotes(t); updateNotes(book.id, t); }} />
                    </View>
                )}

                <View style={styles.metaGrid}>
                    <View style={styles.metaItem}><Text style={styles.metaLabel}>DOWNLOADS</Text><Text style={styles.metaValue}>{book.download_count.toLocaleString()}</Text></View>
                    <View style={styles.metaItem}><Text style={styles.metaLabel}>LANGUAGE</Text><Text style={styles.metaValue}>{book.languages[0]?.toUpperCase()}</Text></View>
                    <View style={styles.metaItem}><Text style={styles.metaLabel}>TYPE</Text><Text style={styles.metaValue}>{book.media_type.toUpperCase()}</Text></View>
                    <View style={styles.metaItem}><Text style={styles.metaLabel}>ID</Text><Text style={styles.metaValue}>#{book.id}</Text></View>
                </View>

                <Text style={styles.desc}>{book.summaries?.[0] || "No summary available for this classic."}</Text>

                <View style={styles.tagRow}>
                    {[...(book.subjects || []), ...(book.bookshelves || [])].slice(0, 10).map((s: string, i: number) => (
                        <View key={i} style={styles.tag}><Text style={styles.tagText}>{s.replace('Category: ', '').split(' -- ')[0]}</Text></View>
                    ))}
                </View>

                
            </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background, alignItems: 'center' },
  responsiveWrapper: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, flex: 1 },
  ambientBg: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', opacity: 0.85 },
  closeBtn: { position: 'absolute', right: 20, zIndex: 50, backgroundColor: 'rgba(50,50,50,0.8)', padding: 10, borderRadius: 25 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100, alignItems: 'center' },
  coverWrapper: { shadowColor: THEME.accent, shadowOffset: {width:0, height:10}, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20, marginBottom: 30 },
  cover: { width: '100%', height: '100%', borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 8, letterSpacing: 0.5 },
  author: { fontSize: 18, color: '#AAA', textAlign: 'center', marginBottom: 30 },
  actionRow: { flexDirection: 'row', width: '100%', gap: 10, marginBottom: 24 },
  mainBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  downloadBtn: { backgroundColor: THEME.accent },
  readBtn: { backgroundColor: '#FFF' },
  secondaryActionBtn: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  disabledBtn: { backgroundColor: '#222' },
  btnText: { fontWeight: '900', fontSize: 12, letterSpacing: 1, color: '#000' },
  iconBtn: { width: 56, height: 56, backgroundColor: '#111', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222' },
  libraryPanel: { width: '100%', backgroundColor: '#0A0A0A', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: '#1A1A1A' },
  sectionHeader: { color: '#444', fontSize: 10, fontWeight: '900', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statusChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#1A1A1A', backgroundColor: '#000' },
  statusText: { color: '#444', fontSize: 10, fontWeight: '800' },
  notesInput: { backgroundColor: '#050505', color: '#FFF', borderRadius: 10, padding: 15, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#1A1A1A', fontSize: 15 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 30, backgroundColor: '#0A0A0A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1A1A1A' },
  metaItem: { width: '50%', marginBottom: 15, alignItems: 'center' },
  metaLabel: { color: '#444', fontSize: 10, fontWeight: '900', marginBottom: 4 },
  metaValue: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  desc: { color: '#999', lineHeight: 26, fontSize: 16, marginBottom: 40, width: '100%' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 40 },
  tag: { backgroundColor: '#111', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#1A1A1A' },
  tagText: { color: '#555', fontSize: 11, fontWeight: '600' },
  secondaryBtn: { flexDirection: 'row', width: '100%', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#222', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
  secondaryBtnText: { color: THEME.accent, fontWeight: '700', fontSize: 14 }
});
