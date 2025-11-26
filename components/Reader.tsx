import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
// Use legacy reader for stable text reading
import { readAsStringAsync } from 'expo-file-system/legacy';

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
      
      // 1. Read the raw file content
      let html = await readAsStringAsync(localUri, { encoding: 'utf8' });

      // 2. Define our Custom Styles (Dark Mode & Typography)
      // We use !important to override any weird styles the book might have.
      const customCSS = `
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          html, body {
            background-color: #050505 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: hidden !important;
          }
          body {
            color: #CCCCCC !important;
            font-family: Georgia, 'Times New Roman', serif !important;
            font-size: 18px !important;
            line-height: 1.6 !important;
            padding: 20px 25px 100px 25px !important;
          }
          /* Force all text elements to respect our color */
          p, div, span, h1, h2, h3, h4, h5, h6, li, blockquote {
            color: #CCCCCC !important;
            background-color: transparent !important;
          }
          /* Links */
          a { 
            color: #2DDA93 !important; 
            text-decoration: none !important; 
            border-bottom: 1px dotted #2DDA93 !important;
          }
          /* Images: Ensure they fit */
          img { 
            max-width: 100% !important; 
            height: auto !important; 
            filter: grayscale(20%) contrast(1.1) !important; 
            display: block;
            margin: 20px auto;
          }
          /* Hide Gutenberg boilerplates */
          .pg-header, .pg-footer, .header, .footer { 
            display: none !important; 
          }
          /* Fix PRE tags (poems/code) */
          pre {
            white-space: pre-wrap !important;
            overflow-x: hidden !important;
          }
        </style>
      `;

      // 3. Inject our styles at the very top of the HTML
      // This ensures they load before the content renders
      setContent(customCSS + html);

    } catch (e) {
      console.error("Reader Error:", e);
      setContent("<h1>Error</h1><p>Could not load book.</p>");
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
                    style={{ backgroundColor: '#050505', flex: 1 }}
                    scalesPageToFit={false} // Let our meta viewport handle scaling
                    showsVerticalScrollIndicator={true}
                    javaScriptEnabled={true}
                    // Only show content when fully loaded to avoid flashes
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color="#2DDA93" />
                        </View>
                    )}
                />
            ) : (
                <View style={styles.center}>
                    {loading ? <ActivityIndicator size="large" color="#2DDA93" /> : <Text style={{color: '#666'}}>Loading Book...</Text>}
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
  webviewContainer: { flex: 1, backgroundColor: '#050505' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
});
