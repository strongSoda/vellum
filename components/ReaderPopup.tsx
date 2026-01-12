import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const ReaderPopup = ({ data, onSave, onDownload, onClose }: any) => {
  if (!data) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>
            {data.type === 'definition' ? 'DICTIONARY' : 'SAVE SNIPPET'}
          </Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close-circle" size={24} color="#444" /></TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {data.type === 'definition' || data.type === 'prompt_download' ? (
            <View>
               <Text style={styles.wordTitle}>{data.word?.toUpperCase()}</Text>
               <Text style={styles.definitionText}>{data.content}</Text>
               {data.type === 'prompt_download' && (
                 <TouchableOpacity style={styles.saveBtn} onPress={onDownload}>
                   <Text style={styles.saveBtnText}>Download Dictionary (8MB)</Text>
                 </TouchableOpacity>
               )}
            </View>
          ) : (
            <View>
              <Text style={styles.snippetPreview}>"{data.content}"</Text>
              <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(data.content)}>
                <Text style={styles.saveBtnText}>Save to Library Notes</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 9999,
    elevation: 10, },
  sheet: { backgroundColor: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '45%' },
  handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: '#2DDA93', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  wordTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  definitionText: { color: '#BBB', fontSize: 15, lineHeight: 22 },
  snippetPreview: { color: '#FFF', fontSize: 14, backgroundColor: '#000', padding: 12, borderRadius: 8, marginBottom: 15 },
  saveBtn: { backgroundColor: '#2DDA93', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  saveBtnText: { color: '#000', fontWeight: 'bold' }
});
