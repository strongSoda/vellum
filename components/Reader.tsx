import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
// FIX: Import from 'legacy' to resolve the deprecation error
import { readAsStringAsync } from 'expo-file-system/legacy';

export const ReaderModal = ({ visible, book, onClose, localUri }: any) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && localUri) {
      loadHtmlContent();
    }
  }, [visible, localUri]);

  const loadHtmlContent = async () => {
    try {
      setLoading(true);
      
      // FIX: Use legacy function with 'utf8' string literal
      const html = await readAsStringAsync(localUri, { encoding: 'utf8' });
      
      setContent(html);
    } catch (e) {
      console.error("Failed to load HTML", e);
      setContent("<h1>Error loading book.</h1><p>The file may be corrupted or missing.</p>");
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !book) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                <Ionicons name="chevron-down" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
            <View style={{width: 40}} /> 
        </View>

        <View style={styles.webviewContainer}>
            {!loading && content ? (
                <WebView 
                    originWhitelist={['*']}
                    source={{ html: content, baseUrl: '' }}
                    style={{ backgroundColor: '#000' }}
                    injectedJavaScript={`
                        const style = document.createElement('style');
                        style.innerHTML = 'body { background-color: #050505; color: #DDD; font-family: Georgia, serif; font-size: 120%; line-height: 1.6; padding: 20px; } .pg-header { display: none; } a { color: #2DDA93; }';
                        document.head.appendChild(style);
                    `}
                />
            ) : (
                <View style={styles.center}>
                    {loading ? <ActivityIndicator size="large" color="#2DDA93" /> : <Text style={{color: '#666'}}>Book content not available.</Text>}
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
