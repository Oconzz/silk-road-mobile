import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSubscription } from '../context/SubscriptionContext';
import type { RootStackParamList } from '../types/navigation';
import {
  PRICING,
  type FreemiumResourceType,
  FREEMIUM_RESOURCE_LABELS,
  getFreemiumLimit,
  getSeatsNeeded,
  getPacksNeededForSeats,
} from '../types/subscription';

interface FreemiumCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
}

interface SeatCheckResult {
  allowed: boolean;
  availableSeats: number;
  seatsNeeded: number;
  packsNeeded: number;
  additionalCost: number;
}

export const useFreemiumLimits = () => {
  const { subscription } = useSubscription();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isSubscribed = subscription.isSubscribed;

  /**
   * Check if a resource action is allowed under freemium limits.
   * If subscribed, always returns allowed: true.
   */
  const checkLimit = useCallback(
    (resource: FreemiumResourceType, currentCount: number): FreemiumCheckResult => {
      if (isSubscribed) {
        return { allowed: true, currentCount, limit: Infinity };
      }
      const limit = getFreemiumLimit(resource);
      return {
        allowed: currentCount < limit,
        currentCount,
        limit,
      };
    },
    [isSubscribed],
  );

  /**
   * Check limit and show an alert prompting upgrade if exceeded.
   * Returns true if the action is allowed, false if blocked.
   */
  const enforceLimit = useCallback(
    (resource: FreemiumResourceType, currentCount: number): boolean => {
      const result = checkLimit(resource, currentCount);
      if (result.allowed) return true;

      const label = FREEMIUM_RESOURCE_LABELS[resource];
      Alert.alert(
        'Limit Reached',
        `You've reached the free limit of ${result.limit} ${label.toLowerCase()}. Subscribe to unlock unlimited access.`,
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'View Plans',
            onPress: () =>
              navigation.navigate('PlanSelection', { fromRegistration: false }),
          },
        ],
      );
      return false;
    },
    [checkLimit, navigation],
  );

  /**
   * Check if inviting N new team members is within seat allowance.
   * Freemium: no invites allowed.
   * Subscribed: checks against totalSeats from subscription.
   */
  const checkSeats = useCallback(
    (currentMemberCount: number, newInvites: number = 1): SeatCheckResult => {
      if (!isSubscribed) {
        return {
          allowed: false,
          availableSeats: 0,
          seatsNeeded: newInvites,
          packsNeeded: 0,
          additionalCost: 0,
        };
      }

      const totalSeats = subscription.totalSeats;
      const needed = getSeatsNeeded(totalSeats, currentMemberCount, newInvites);

      if (needed === 0) {
        return {
          allowed: true,
          availableSeats: totalSeats - currentMemberCount,
          seatsNeeded: 0,
          packsNeeded: 0,
          additionalCost: 0,
        };
      }

      const packsNeeded = getPacksNeededForSeats(needed);
      return {
        allowed: false,
        availableSeats: Math.max(0, totalSeats - currentMemberCount),
        seatsNeeded: needed,
        packsNeeded,
        additionalCost: packsNeeded * PRICING.seatPackPrice,
      };
    },
    [isSubscribed, subscription.totalSeats],
  );

  /**
   * Check seats and show upgrade alert if exceeded.
   * Returns true if allowed, false if blocked.
   */
  const enforceSeats = useCallback(
    (currentMemberCount: number, newInvites: number = 1): Promise<boolean> => {
      return new Promise(resolve => {
        if (!isSubscribed) {
          Alert.alert(
            'Subscription Required',
            'You need an active subscription to invite team members.',
            [
              { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'View Plans',
                onPress: () => {
                  navigation.navigate('PlanSelection', { fromRegistration: false });
                  resolve(false);
                },
              },
            ],
          );
          return;
        }

        const result = checkSeats(currentMemberCount, newInvites);
        if (result.allowed) {
          resolve(true);
          return;
        }

        Alert.alert(
          'Additional Seats Required',
          `You need ${result.seatsNeeded} more seat${result.seatsNeeded > 1 ? 's' : ''}. ` +
          `Add ${result.packsNeeded} seat pack${result.packsNeeded > 1 ? 's' : ''} ` +
          `(+$${result.additionalCost}/mo) to continue.`,
          [
            { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Add Seats',
              onPress: () => {
                navigation.navigate('PlanSelection', { fromRegistration: false });
                resolve(false);
              },
            },
          ],
        );
      });
    },
    [isSubscribed, checkSeats, navigation],
  );

  const seatInfo = useMemo(() => {
    if (!isSubscribed) {
      return {
        totalSeats: PRICING.baseSeats,
        usedLabel: 'Free Plan (1 seat)',
        isFreemium: true,
      };
    }
    return {
      totalSeats: subscription.totalSeats,
      usedLabel: `SilkRoad Pro (${subscription.totalSeats} seat${subscription.totalSeats > 1 ? 's' : ''})`,
      isFreemium: false,
    };
  }, [isSubscribed, subscription.totalSeats]);

  return {
    isSubscribed,
    checkLimit,
    enforceLimit,
    checkSeats,
    enforceSeats,
    seatInfo,
  };
};
