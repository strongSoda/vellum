import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

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
