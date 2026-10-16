import { AppPalette } from '@/constants/theme';
import { useAppTheme, useThemedStyles } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics'; // Import Haptics
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const BookCard = ({ item, onPress }: { item: any; onPress: () => void }) => {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const coverUrl = item.formats['image/jpeg'];
  const author = item.authors[0]?.name.split(',').reverse().join(' ').trim() || 'Unknown';

  const handlePress = () => {
      Haptics.selectionAsync(); // Add Haptic Feedback
      onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.cardContainer} activeOpacity={0.8}>
      <View style={styles.imageWrapper}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.placeholderImage]}>
            <Ionicons name="book-outline" size={32} color={colors.textMuted} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.cardAuthor}>{author}</Text>
    </TouchableOpacity>
  );
};

const makeStyles = (c: AppPalette) => StyleSheet.create({
  cardContainer: { flex: 1, margin: 8, marginBottom: 20 },
  imageWrapper: {
    shadowColor: c.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 5, marginBottom: 10,
  },
  cardImage: { width: '100%', aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: c.surfaceAlt },
  placeholderImage: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.borderStrong },
  cardTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  cardAuthor: { color: c.textMuted, fontSize: 12, marginTop: 4 },
});
