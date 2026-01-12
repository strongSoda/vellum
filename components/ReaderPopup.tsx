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
            {data.type === 'definition' ? data.word.toUpperCase() : 'SAVE SNIPPET'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={24} color="#444" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {data.type === 'definition' ? (
            <Text style={styles.definitionText}>{data.content}</Text>
          ) : (
            <View>
              <Text style={styles.snippetPreview}>"{data.content}"</Text>
              <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(data.content)}>
                <Ionicons name="bookmark" size={18} color="#000" style={{marginRight: 8}} />
                <Text style={styles.saveBtnText}>Save to Library Notes</Text>
              </TouchableOpacity>
            </View>
          )}

          {data.type === 'prompt_download' && (
            <TouchableOpacity style={styles.saveBtn} onPress={onDownload}>
              <Text style={styles.saveBtnText}>Download Offline Dictionary (8MB)</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '50%', borderTopWidth: 1, borderTopColor: '#333' },
  handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { color: '#2DDA93', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  content: { marginBottom: 20 },
  definitionText: { color: '#CCC', fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
  snippetPreview: { color: '#FFF', fontSize: 14, lineHeight: 22, backgroundColor: '#000', padding: 12, borderRadius: 8, marginBottom: 15 },
  saveBtn: { backgroundColor: '#2DDA93', flexDirection: 'row', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#000', fontWeight: 'bold' }
});
