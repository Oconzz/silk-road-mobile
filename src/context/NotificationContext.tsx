import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { api } from '../services/api/core/httpClient';
import type { NotificationPreferences } from '../types/notification';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../types/notification';

interface NotificationContextType {
  hasPermission: boolean;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  deviceToken: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  hasPermission: false,
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  updatePreferences: async () => {},
  requestPermission: async () => false,
  deviceToken: null,
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const tokenRegistered = useRef(false);

  // Initialize notification service
  useEffect(() => {
    const init = async () => {
      await notificationService.initialize();
      const perm = await notificationService.hasPermission();
      setHasPermission(perm);
      const prefs = await notificationService.getPreferences();
      setPreferences(prefs);
      const token = await notificationService.getToken();
      setDeviceToken(token);
    };
    init();
  }, []);

  // Set/clear OneSignal external user ID based on auth state
  useEffect(() => {
    if (isAuthenticated && user?.userId) {
      notificationService.setExternalUserId(user.userId);
    } else {
      notificationService.clearExternalUserId();
    }
  }, [isAuthenticated, user?.userId]);

  // Re-check permission when app comes back to foreground
  useEffect(() => {
    const handleAppState = async (state: AppStateStatus) => {
      if (state === 'active') {
        const perm = await notificationService.hasPermission();
        setHasPermission(perm);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  // Fetch preferences from backend when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchBackendPreferences = async () => {
      try {
        const data = await api.get<NotificationPreferences>('/api/notifications/preferences');
        if (data) {
          setPreferences(data);
          await notificationService.savePreferences(data);
          console.log('[NotificationContext] Preferences synced from backend');
        }
      } catch (error) {
        console.log('[NotificationContext] Could not fetch backend preferences, using local:', error);
      }
    };
    fetchBackendPreferences();
  }, [isAuthenticated]);

  // Register device token with backend when authenticated
  useEffect(() => {
    if (!isAuthenticated || !deviceToken || tokenRegistered.current) return;

    const registerToken = async () => {
      try {
        const payload = await notificationService.getDeviceTokenPayload();
        if (!payload) return;

        await api.post('/api/notifications/register-device', payload);
        tokenRegistered.current = true;
        console.log('[NotificationContext] Device token registered with backend');
      } catch (error) {
        console.error('[NotificationContext] Failed to register device token:', error);
      }
    };
    registerToken();
  }, [isAuthenticated, deviceToken]);

  // Reset registration flag on logout
  useEffect(() => {
    if (!isAuthenticated) {
      tokenRegistered.current = false;
    }
  }, [isAuthenticated]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await notificationService.requestPermission();
    setHasPermission(granted);

    if (granted) {
      const token = await notificationService.getToken();
      setDeviceToken(token);
    }

    return granted;
  }, []);

  const updatePreferences = useCallback(async (partial: Partial<NotificationPreferences>) => {
    const updated = { ...preferences, ...partial };
    setPreferences(updated);
    await notificationService.savePreferences(updated);

    // Sync to backend
    if (isAuthenticated) {
      try {
        await api.put('/api/notifications/preferences', updated);
      } catch (error) {
        console.error('[NotificationContext] Failed to sync preferences:', error);
      }
    }
  }, [preferences, isAuthenticated]);

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        preferences,
        updatePreferences,
        requestPermission,
        deviceToken,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
