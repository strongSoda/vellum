import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

export const triggerAppRating = async () => {
  try {
    const hasRated = await AsyncStorage.getItem('@vellum_has_rated');
    
    // Only proceed if they haven't seen the prompt in this version session
    // and the device supports it
    if (!hasRated && (await StoreReview.isAvailableAsync())) {
      await StoreReview.requestReview();
      // Mark as prompted so we don't ask again immediately next time
      await AsyncStorage.setItem('@vellum_has_rated', 'true');
    }
  } catch (e) {
    // Silently fail if rating isn't available
  }
};

const APPLE_APP_ID = '6755439718'; // Example ID

export const openAppStoreRating = () => {
  if (Platform.OS === 'ios') {
    // Correct format using the numerical ID
    const url = `itms-apps://itunes.apple.com/app/id${APPLE_APP_ID}?action=write-review`;

    console.log(url);
    
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to standard https if itms-apps is not supported (e.g., Simulator)
        Linking.openURL(`https://apps.apple.com/app/id${APPLE_APP_ID}`);
      }
    });
  } else {
    // For Android (remains using package name)
    Linking.openURL(`market://details?id=com.strongsoda.vellum.reader`);
  }
};