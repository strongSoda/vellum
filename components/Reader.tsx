import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
// FIX: Use the legacy reader which is stable for reading text content
import { readAsStringAsync } from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';

export const ReaderModal = ({ visible, book, onClose, localUri }: any) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && localUri) {
      loadBookContent();
    }
  }, [visible, localUri]);

  const loadBookContent = async () => {
    try {
      setLoading(true);
      // FIX: Read the file content into memory as a UTF8 string
      const html = await readAsStringAsync(localUri, { encoding: 'utf8' });
      setContent(html);
    } catch (e) {
      console.error("Reader Error:", e);
      setContent("<h1>Error</h1><p>Could not load the book file. Please try downloading it again.</p>");
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !book) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                <Ionicons name="chevron-down" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
            <View style={{width: 40}} /> 
        </View>

        {/* WebView */}
        <View style={styles.webviewContainer}>
            {!loading && content ? (
                <WebView 
                    originWhitelist={['*']}
                    source={{ html: content, baseUrl: '' }} // FIX: Direct HTML injection
                    style={{ backgroundColor: '#000' }}
                    // Inject styling for Dark Mode
                    injectedJavaScript={`
                        const style = document.createElement('style');
                        style.innerHTML = 'body { background-color: #050505; color: #DDD; font-family: Georgia, serif; font-size: 120%; line-height: 1.6; padding: 20px; } .pg-header { display: none; } a { color: #2DDA93; }';
                        document.head.appendChild(style);
                    `}
                />
            ) : (
                <View style={styles.center}>
                    {loading ? <ActivityIndicator size="large" color="#2DDA93" /> : <Text style={{color: '#666'}}>Book empty.</Text>}
                </View>
            )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#050505', zIndex: 10 },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  webviewContainer: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
