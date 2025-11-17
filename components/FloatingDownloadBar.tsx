import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLibrary } from '../context/LibraryContext';

const { width } = Dimensions.get('window');

export const FloatingDownloadBar = ({ onPress }: { onPress: () => void }) => {
  const { activeDownload } = useLibrary();

  if (!activeDownload) return null;

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.9}>
      <View style={styles.content}>
        <ActivityIndicator size="small" color="#000" style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Downloading...</Text>
          <Text style={styles.title} numberOfLines={1}>{activeDownload.title}</Text>
        </View>
        <Ionicons name="chevron-up" size={24} color="#000" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70, // Above tab bar
    left: 16,
    right: 16,
    backgroundColor: '#2DDA93', // Mint Green
    borderRadius: 12,
    padding: 4,
    elevation: 10,
    shadowColor: '#2DDA93',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
