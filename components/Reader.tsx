import { triggerAppRating } from '@/utils/Ratings';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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
      console.log('Loading book content from:', localUri);
      
      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist at path: ' + localUri);
      }
      
      console.log('File exists, size:', fileInfo.size);
      
      // Read the raw file content using legacy API
      let html = await FileSystem.readAsStringAsync(localUri, { 
        encoding: 'utf8'
      });

      console.log('File content loaded, length:', html.length);

      // Define our Custom Styles (Dark Mode & Typography)
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

      // Inject our styles at the very top of the HTML
      setContent(customCSS + html);
      console.log('Content prepared for display');

    } catch (e) {
      console.error("Reader Error:", e);
      if (e instanceof Error) {
        console.error("Error message:", e.message);
      }
      setContent(`<html><body style="background: #050505; color: #fff; padding: 20px; font-family: system-ui;">
        <h1>Error Loading Book</h1>
        <p>Could not load the book content. The file may be corrupted or the path is incorrect.</p>
        <p style="color: #888; font-size: 12px;">Path: ${localUri}</p>
      </body></html>`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Trigger rating after the modal starts to slide away
    setTimeout(() => {
      triggerAppRating();
    }, 1000);
  };

  if (!visible || !book) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
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
              scalesPageToFit={false}
              showsVerticalScrollIndicator={true}
              javaScriptEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color="#2DDA93" />
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error:', nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView HTTP error:', nativeEvent.statusCode);
              }}
            />
          ) : (
            <View style={styles.center}>
              {loading ? (
                <>
                  <ActivityIndicator size="large" color="#2DDA93" />
                  <Text style={{color: '#666', marginTop: 16}}>Loading Book...</Text>
                </>
              ) : (
                <Text style={{color: '#666'}}>Unable to load content</Text>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222', 
    backgroundColor: '#050505', 
    zIndex: 10 
  },
  backBtn: { padding: 8 },
  headerTitle: { 
    color: '#FFF', 
    fontSize: 14, 
    fontWeight: 'bold', 
    flex: 1, 
    textAlign: 'center' 
  },
  webviewContainer: { flex: 1, backgroundColor: '#050505' },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#050505' 
  },
});
