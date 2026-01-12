import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const UpdateBanner = () => {
  const [visible, setVisible] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    checkUpdateStatus();
  }, []);

  const checkUpdateStatus = async () => {
    // We use a key to ensure the user only sees this specific update banner once
    const LAST_BANNER_ID = 'update_banner_12_Jan_2026';
    const hasSeen = await AsyncStorage.getItem(LAST_BANNER_ID);

    // If we just downloaded an update or if they haven't seen this specific message
    if (!hasSeen) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 20, // Distance from top
        useNativeDriver: true,
      }).start();
    }
  };

  const dismiss = async () => {
    await AsyncStorage.setItem('update_banner_12_Jan_2026', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <Ionicons name="book" size={20} color="#000" style={{ marginRight: 10 }} />
        <Text style={styles.text}>224 new books added on 12 Jan, 2026!</Text>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color="#333" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 50, // Adjust based on your SafeAreaView/Header
    left: 20,
    right: 20,
    backgroundColor: '#2DDA93', // Matching your app's mint green accent
    borderRadius: 12,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingRight: 40,
  },
  text: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  closeBtn: {
    position: 'absolute',
    right: 10,
  }
});
