import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

export const ReaderModal = ({ visible, book, onClose, localUri }: any) => {
  const [loading, setLoading] = useState(true);

  if (!visible || !book) return null;

  // Calculate the parent directory to grant read access (Required for iOS)
  const parentDir = localUri ? localUri.substring(0, localUri.lastIndexOf('/')) : undefined;

  const INJECTED_CSS = `
    const style = document.createElement('style');
    style.innerHTML = \`
      body { 
        background-color: #050505 !important; 
        color: #CCCCCC !important; 
        font-family: Georgia, serif !important; 
        font-size: 120% !important; 
        line-height: 1.6 !important; 
        padding: 20px 20px 100px 20px !important;
      }
      a { color: #2DDA93 !important; text-decoration: none !important; }
      img { max-width: 100% !important; height: auto !important; }
      .pg-header, .pg-footer { display: none !important; }
    \`;
    document.head.appendChild(style);
  `;

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
            {localUri ? (
                <WebView 
                  startInLoadingState={true}
                    useWebKit={true} 
                    originWhitelist={['*']}
                    source={{ uri: localUri }}
                    style={{ backgroundColor: '#000', flex: 1 }}
                    
                    // FIX: iOS requires explicit read permission for file:// URLs
                    allowFileAccess={true}
                    allowFileAccessFromFileURLs={true}
                    allowUniversalAccessFromFileURLs={true}
                    allowingReadAccessToURL={parentDir} // <--- THE CRITICAL FIX
                    renderLoading={()=>(<ActivityIndicator size='large' 
style={{marginTop:100}} />)}
                    
                    injectedJavaScript={INJECTED_CSS}
                    onLoadEnd={() => setLoading(false)}
                    onError={(e) => console.log("WebView Error", e.nativeEvent)}
                />
            ) : (
                <View style={styles.center}>
                    <Text style={{color: '#666'}}>File not found.</Text>
                </View>
            )}
            
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#2DDA93" />
                    <Text style={{color: '#2DDA93', marginTop: 10, fontWeight: 'bold'}}>Opening Book...</Text>
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
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', zIndex: 5 }
});
