import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { subscriptionService } from '../services/subscriptionService';
import { useAuth } from './AuthContext';
import { PRICING, type BillingPeriod, type SubscriptionState, type SubscriptionTierId } from '../types/subscription';
import { api } from '../services/api/core/httpClient';

interface SubscriptionContextType {
  subscription: SubscriptionState;
  refreshSubscription: () => Promise<void>;
  purchaseForTier: (tierId: SubscriptionTierId, period?: BillingPeriod) => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  isReady: boolean;
}

const defaultState: SubscriptionState = {
  isSubscribed: false,
  tierId: 'starter',
  billingPeriod: 'monthly',
  productIdentifier: null,
  expirationDate: null,
  willRenew: false,
  seatPacks: 0,
  totalSeats: PRICING.baseSeats,
  monthlyPrice: 0,
  isUnlimited: false,
  isLoading: true,
  error: null,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: defaultState,
  refreshSubscription: async () => {},
  purchaseForTier: async () => false,
  presentCustomerCenter: async () => {},
  isReady: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>(defaultState);
  const [isReady, setIsReady] = useState(false);
  const listenerCleanup = useRef<(() => void) | null>(null);

  // Initialize RevenueCat when app starts
  useEffect(() => {
    const init = async () => {
      await subscriptionService.initialize();
      setIsReady(true);
      if (__DEV__) {
        await subscriptionService.debugConnection();
      }
    };
    init();
  }, []);

  // Identify user when authenticated
  useEffect(() => {
    if (isReady && isAuthenticated && user?.userId) {
      subscriptionService.identify(user.userId);
    }
  }, [isReady, isAuthenticated, user?.userId]);

  // Refresh subscription state
  const refreshSubscription = useCallback(async () => {
    setSubscription(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const state = await subscriptionService.getSubscriptionState();
      setSubscription(state);
    } catch (error: any) {
      setSubscription(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load subscription',
      }));
    }
  }, []);

  // Listen for real-time customer info updates from RevenueCat
  useEffect(() => {
    if (!isReady || !isAuthenticated) return;

    listenerCleanup.current = subscriptionService.addCustomerInfoListener((info) => {
      const parsed = subscriptionService.parseCustomerInfo(info);
      setSubscription(parsed);
    });

    return () => {
      listenerCleanup.current?.();
      listenerCleanup.current = null;
    };
  }, [isReady, isAuthenticated]);

  // Initial fetch when user becomes authenticated
  useEffect(() => {
    if (isReady && isAuthenticated) {
      refreshSubscription();
    } else if (!isAuthenticated) {
      setSubscription({ ...defaultState, isLoading: false });
    }
  }, [isReady, isAuthenticated, refreshSubscription]);

  // Sync subscription state with the backend after any purchase/change
  const syncWithBackend = useCallback(async (state: SubscriptionState) => {
    try {
      await api.post('/api/subscription/sync', {
        IsActive: state.isSubscribed,
        Plan: state.productIdentifier,
        UserPacks: state.seatPacks,
        ExpirationDate: state.expirationDate,
      });
      console.log('[SubscriptionContext] Synced with backend');
    } catch (error) {
      console.warn('[SubscriptionContext] Backend sync failed (non-blocking):', error);
    }
  }, []);

  // Purchase a subscription for a specific tier and billing period
  const purchaseForTier = useCallback(async (tierId: SubscriptionTierId, period: BillingPeriod = 'monthly'): Promise<boolean> => {
    const info = await subscriptionService.purchaseForTier(tierId, period);
    if (info) {
      const newState = await subscriptionService.getSubscriptionState();
      setSubscription(newState);
      await syncWithBackend(newState);
      return true;
    }
    return false;
  }, [syncWithBackend]);

  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    await subscriptionService.presentCustomerCenter();
    await refreshSubscription();
  }, [refreshSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        refreshSubscription,
        purchaseForTier,
        presentCustomerCenter,
        isReady,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
