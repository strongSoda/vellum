import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system'; // STRICT NEW API
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export const ReaderModal = ({ visible, book, onClose, localUri }: any) => {
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const webViewRef = useRef<WebView>(null);

  const READER_HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"><script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"></script><script src="https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js"></script><style>body { margin: 0; background: #050505; color: #ccc; height: 100vh; overflow: hidden; display: flex; flex-direction: column; } #viewer { flex: 1; width: 100%; height: 100%; }</style></head><body><div id="viewer"></div><script>var rendition; document.addEventListener("message", function(event) { try { var msg = JSON.parse(event.data); if (msg.type === 'init') { var binary_string = window.atob(msg.payload); var len = binary_string.length; var bytes = new Uint8Array(len); for (var i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); } var book = ePub(bytes.buffer); rendition = book.renderTo("viewer", { width: "100%", height: "100%", flow: "paginated" }); rendition.themes.register("dark", { body: { color: "#CCC", background: "#050505", "font-family": "Georgia", "padding": "0 20px" }, p: { "font-size": "18px", "line-height": "1.6" }, a: { color: "#2DDA93", "text-decoration": "none" } }); rendition.display().then(() => { rendition.themes.select("dark"); rendition.themes.fontSize("${fontSize}%"); }); rendition.on("click", (e) => { var width = window.innerWidth; if (e.clientX > width * 0.7) rendition.next(); else if (e.clientX < width * 0.3) rendition.prev(); }); } if (msg.type === 'font') { if (rendition) rendition.themes.fontSize(msg.payload + "%"); } } catch(e) { window.ReactNativeWebView.postMessage("ERROR: " + e.message); } });</script></body></html>`;

  const injectBookData = async () => {
    if (!localUri) return;
    try {
      // New API: Read as Base64 via class
      const file = new File(localUri);
      const base64 = await file.base64();
      
      webViewRef.current?.postMessage(JSON.stringify({ type: 'init', payload: base64 }));
      setLoading(false);
    } catch (e) {
      console.error("Error reading epub:", e);
      setLoading(false);
    }
  };

  const changeFontSize = (delta: number) => {
      const newSize = Math.max(60, Math.min(200, fontSize + delta));
      setFontSize(newSize);
      Haptics.selectionAsync();
      webViewRef.current?.postMessage(JSON.stringify({ type: 'font', payload: newSize }));
  };

  useEffect(() => {
      if(visible) {
          setLoading(true);
          setFontSize(100);
      }
  }, [visible]);

  if (!visible || !book) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                <Ionicons name="chevron-down" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.fontControls}>
                <TouchableOpacity onPress={() => changeFontSize(-10)} style={styles.fontBtn}>
                    <Ionicons name="remove" size={20} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.fontLabel}>Aa</Text>
                <TouchableOpacity onPress={() => changeFontSize(10)} style={styles.fontBtn}>
                    <Ionicons name="add" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.webviewContainer}>
            <WebView 
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: READER_HTML, baseUrl: '' }} 
                style={{ backgroundColor: '#000' }}
                onLoadEnd={injectBookData} 
                javaScriptEnabled={true}
            />
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#2DDA93" />
                    <Text style={{color: '#2DDA93', marginTop: 10, fontWeight: 'bold'}}>Loading Book Engine...</Text>
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
  fontControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 4 },
  fontBtn: { padding: 8, paddingHorizontal: 12 },
  fontLabel: { color: '#888', fontSize: 14, fontWeight: 'bold' },
  webviewContainer: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' }
});
