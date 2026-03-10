// Push Notification Service — OneSignal SDK
// Wraps react-native-onesignal for push notifications

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OneSignal, type NotificationClickEvent } from 'react-native-onesignal';
import Config from 'react-native-config';
import type {
  DeviceTokenPayload,
  NotificationPreferences,
  NotificationTopic,
  NotificationNavTarget,
} from '../types/notification';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_NAV_MAP,
} from '../types/notification';

const STORAGE_KEY_PREFERENCES = '@notification_preferences';
const STORAGE_KEY_DEVICE_TOKEN = '@notification_device_token';

class NotificationService {
  private _token: string | null = null;
  private _onNotificationPressed: ((target: NotificationNavTarget) => void) | null = null;
  private _initialized = false;

  /**
   * Initialize OneSignal push notifications.
   * Call this early in the app lifecycle (e.g., in NotificationContext).
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      const appId = Config.ONESIGNAL_APP_ID;
      if (!appId) {
        console.warn('[NotificationService] ONESIGNAL_APP_ID not set — push notifications disabled.');
        return;
      }

      OneSignal.initialize(appId);
      console.log('[NotificationService] OneSignal initialized with app ID:', appId.substring(0, 8) + '...');

      // Request permission (shows native iOS prompt, Android auto-grants < 13)
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log('[NotificationService] Permission granted:', granted);

      // Listen for notification clicks (foreground + background)
      OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
        console.log('[NotificationService] Notification clicked:', event.notification.additionalData);
        this._handleNotificationPress(event.notification.additionalData);
      });

      // Get push subscription token (playerId/subscriptionId for backend)
      const pushSub = OneSignal.User.pushSubscription;
      const subId = pushSub.getPushSubscriptionId();
      const pushToken = pushSub.getPushSubscriptionToken();
      const tokenValue = pushToken || subId || null;

      if (tokenValue) {
        this._token = tokenValue;
        await AsyncStorage.setItem(STORAGE_KEY_DEVICE_TOKEN, tokenValue);
        console.log('[NotificationService] Push token:', tokenValue.substring(0, 20) + '...');
      }

      // Listen for subscription changes (token refresh)
      pushSub.addEventListener('change', (sub) => {
        const newToken = sub.current.token || sub.current.id || null;
        if (newToken && newToken !== this._token) {
          this._token = newToken;
          AsyncStorage.setItem(STORAGE_KEY_DEVICE_TOKEN, newToken);
          console.log('[NotificationService] Push token updated');
        }
      });

      this._initialized = true;
    } catch (error) {
      console.error('[NotificationService] Init error:', error);
    }
  }

  /**
   * Set the OneSignal external user ID (for targeting from backend).
   */
  setExternalUserId(userId: string): void {
    if (!this._initialized) return;
    try {
      OneSignal.login(userId);
      console.log('[NotificationService] External user ID set:', userId);
    } catch (error) {
      console.error('[NotificationService] Failed to set external user ID:', error);
    }
  }

  /**
   * Clear external user ID on logout.
   */
  clearExternalUserId(): void {
    if (!this._initialized) return;
    try {
      OneSignal.logout();
      console.log('[NotificationService] External user ID cleared');
    } catch (error) {
      console.error('[NotificationService] Failed to clear external user ID:', error);
    }
  }

  /**
   * Get the current device token (OneSignal subscription ID or push token).
   */
  async getToken(): Promise<string | null> {
    if (this._token) return this._token;
    const stored = await AsyncStorage.getItem(STORAGE_KEY_DEVICE_TOKEN);
    return stored;
  }

  /**
   * Get the device token payload for backend registration.
   */
  async getDeviceTokenPayload(): Promise<DeviceTokenPayload | null> {
    const token = await this.getToken();
    if (!token) return null;

    return {
      token,
      platform: Platform.OS as 'ios' | 'android',
    };
  }

  /**
   * Set callback for notification press navigation.
   */
  setOnNotificationPressed(callback: (target: NotificationNavTarget) => void): void {
    this._onNotificationPressed = callback;
  }

  /**
   * Check if notification permissions are granted.
   */
  async hasPermission(): Promise<boolean> {
    try {
      if (!this._initialized) return false;
      return OneSignal.Notifications.hasPermission();
    } catch {
      return false;
    }
  }

  /**
   * Request notification permissions.
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!this._initialized) {
        await this.initialize();
      }
      return await OneSignal.Notifications.requestPermission(true);
    } catch {
      return false;
    }
  }

  // -- Tags (for topic-based targeting from backend) --

  /**
   * Sync notification preferences as OneSignal tags.
   * Backend can use these to filter which users receive which notifications.
   */
  async syncTagsFromPreferences(prefs: NotificationPreferences): Promise<void> {
    if (!this._initialized) return;
    try {
      OneSignal.User.addTags({
        notifications_enabled: prefs.enabled ? '1' : '0',
        topic_material_return: prefs.materialReturn ? '1' : '0',
        topic_timecard_reminder: prefs.timecardReminder ? '1' : '0',
        topic_job_assignment: prefs.jobAssignment ? '1' : '0',
        topic_reward_goal: prefs.rewardGoal ? '1' : '0',
        topic_review_prompt: prefs.reviewPrompt ? '1' : '0',
      });
      console.log('[NotificationService] Tags synced from preferences');
    } catch (error) {
      console.error('[NotificationService] Failed to sync tags:', error);
    }
  }

  // -- Preferences (local storage) --

  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_PREFERENCES);
      if (stored) {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  async savePreferences(prefs: NotificationPreferences): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(prefs));
    // Also sync as OneSignal tags for backend targeting
    await this.syncTagsFromPreferences(prefs);
  }

  async isTopicEnabled(topic: NotificationTopic): Promise<boolean> {
    const prefs = await this.getPreferences();
    if (!prefs.enabled) return false;

    switch (topic) {
      case 'material_return': return prefs.materialReturn;
      case 'timecard_reminder': return prefs.timecardReminder;
      case 'job_assignment': return prefs.jobAssignment;
      case 'reward_goal': return prefs.rewardGoal;
      case 'review_prompt': return prefs.reviewPrompt;
      case 'general': return true;
    }
  }

  // -- Private Helpers --

  private _handleNotificationPress(additionalData: any): void {
    if (!this._onNotificationPressed || !additionalData) return;

    const topic = (additionalData.topic as NotificationTopic) || 'general';
    const navFn = NOTIFICATION_NAV_MAP[topic];
    if (navFn) {
      const target = navFn(additionalData);
      this._onNotificationPressed(target);
    }
  }
}

export const notificationService = new NotificationService();
