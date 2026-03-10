import InAppReview from 'react-native-in-app-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ACTIVITY_COUNT: '@inAppReview:activityCount',
  LAST_REVIEW_DATE: '@inAppReview:lastReviewDate',
  HAS_REVIEWED: '@inAppReview:hasReviewed',
};

const ACTIVITY_THRESHOLD = 10;
const DAYS_BETWEEN_PROMPTS = 30;

class InAppReviewService {
  private activityCount = 0;
  private lastReviewDate: Date | null = null;
  private hasReviewed = false;

  async initialize(): Promise<void> {
    try {
      const [countStr, dateStr, reviewedStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVITY_COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_REVIEW_DATE),
        AsyncStorage.getItem(STORAGE_KEYS.HAS_REVIEWED),
      ]);

      this.activityCount = countStr ? parseInt(countStr, 10) : 0;
      this.lastReviewDate = dateStr ? new Date(dateStr) : null;
      this.hasReviewed = reviewedStr === 'true';
    } catch (error) {
      console.log('[InAppReview] Error initializing:', error);
    }
  }

  async trackActivity(): Promise<void> {
    this.activityCount += 1;
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVITY_COUNT, String(this.activityCount));

    if (this.shouldShowReview()) {
      await this.requestReview();
    }
  }

  private shouldShowReview(): boolean {
    if (this.activityCount < ACTIVITY_THRESHOLD) {
      return false;
    }

    if (this.lastReviewDate) {
      const daysSinceLastPrompt = Math.floor(
        (Date.now() - this.lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastPrompt < DAYS_BETWEEN_PROMPTS) {
        return false;
      }
    }

    return true;
  }

  async requestReview(): Promise<boolean> {
    try {
      const isAvailable = InAppReview.isAvailable();
      
      if (!isAvailable) {
        console.log('[InAppReview] In-app review not available on this device');
        return false;
      }

      const result = await InAppReview.RequestInAppReview();
      console.log('[InAppReview] Review requested, result:', result);

      this.lastReviewDate = new Date();
      this.activityCount = 0;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.LAST_REVIEW_DATE, this.lastReviewDate.toISOString()),
        AsyncStorage.setItem(STORAGE_KEYS.ACTIVITY_COUNT, '0'),
        AsyncStorage.setItem(STORAGE_KEYS.HAS_REVIEWED, 'true'),
      ]);

      return true;
    } catch (error) {
      console.log('[InAppReview] Error requesting review:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return InAppReview.isAvailable();
  }
}

export const inAppReviewService = new InAppReviewService();
