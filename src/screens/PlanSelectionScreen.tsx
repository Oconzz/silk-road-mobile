import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { subscriptionService } from '../services/subscriptionService';
import { useSubscription } from '../context/SubscriptionContext';
import {
  PRICING,
  FREEMIUM_LIMITS,
  SUBSCRIPTION_TIERS,
  SEMI_ANNUAL_PLAN,
  HIGH_VALUE_THRESHOLD,
  HIGH_VALUE_DISCLAIMER,
  getTotalSeats,
  getMonthlyPrice,
  type DynamicPlan,
  type SubscriptionTierId,
  type BillingPeriod,
} from '../types/subscription';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

type PlanSelectionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PlanSelection'>;
  route: RouteProp<RootStackParamList, 'PlanSelection'>;
};

export const PlanSelectionScreen: React.FC<PlanSelectionScreenProps> = ({
  navigation,
  route,
}) => {
  const { colors } = useTheme();
  const { subscription, refreshSubscription } = useSubscription();
  const isFromRegistration = route.params?.fromRegistration ?? false;

  const [selectedTierId, setSelectedTierId] = useState<SubscriptionTierId>(subscription.tierId || 'starter');
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<DynamicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Fetch dynamic plans from RevenueCat
  useEffect(() => {
    const load = async () => {
      setPlansLoading(true);
      try {
        const fetched = await subscriptionService.getPlans();
        if (fetched.length > 0) setPlans(fetched);
      } catch (e) {
        console.warn('[PlanSelection] Failed to load plans:', e);
      } finally {
        setPlansLoading(false);
      }
    };
    load();
  }, []);

  const selectedTier = SUBSCRIPTION_TIERS.find(t => t.id === selectedTierId) ?? SUBSCRIPTION_TIERS[0];
  const selectedPlan = plans.find(p => p.tierId === selectedTierId && p.period === selectedPeriod);
  const semiAnnualPlan = plans.find(p => p.period === 'semi_annual');

  // Display price
  const displayPrice = selectedPeriod === 'semi_annual'
    ? (semiAnnualPlan?.priceString ?? `$${SEMI_ANNUAL_PLAN.price}`)
    : (selectedPlan?.priceString ?? `$${selectedTier.monthlyPrice}`);

  const displayPeriodLabel = selectedPeriod === 'semi_annual' ? '/6mo' : '/mo';

  const isHighValue = selectedTier.monthlyPrice >= HIGH_VALUE_THRESHOLD || selectedPeriod === 'semi_annual';

  const handleNavigateAway = useCallback(() => {
    if (isFromRegistration) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      navigation.goBack();
    }
  }, [isFromRegistration, navigation]);

  const handleSubscribe = useCallback(async () => {
    const tierId = selectedPeriod === 'semi_annual' ? 'unlimited' : selectedTierId;

    if (isHighValue) {
      Alert.alert(
        'Confirm Subscription',
        HIGH_VALUE_DISCLAIMER,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              await doPurchase(tierId, selectedPeriod);
            },
          },
        ],
      );
    } else {
      await doPurchase(tierId, selectedPeriod);
    }
  }, [selectedTierId, selectedPeriod, isHighValue]);

  const doPurchase = async (tierId: SubscriptionTierId, period: BillingPeriod) => {
    setIsLoading(true);
    try {
      const customerInfo = await subscriptionService.purchaseForTier(tierId, period);
      if (customerInfo) {
        await refreshSubscription();
        Alert.alert('Welcome to SilkRoad Pro!', 'Your subscription is now active.', [
          { text: 'OK', onPress: handleNavigateAway },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Purchase failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = useCallback(async () => {
    setIsLoading(true);
    try {
      await subscriptionService.restorePurchases();
      await refreshSubscription();
      Alert.alert('Success', 'Purchases restored successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshSubscription]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.surface}, { borderBottomColor: colors.divider }]}>
        {!isFromRegistration ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]}>Choose Your Plan</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}15` }]}>
            <Icon name="zap" size={32} color={colors.accent} />
          </View>
          <Text style={[styles.planTitle, { color: colors.text }]}>SilkRoad Pro</Text>
          <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
            Everything you need to run your contracting business
          </Text>
        </View>

        {/* Billing Period Toggle */}
        <View style={[styles.periodToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.periodBtn, selectedPeriod === 'monthly' && { backgroundColor: colors.accent }]}
            onPress={() => setSelectedPeriod('monthly')}
          >
            <Text style={[styles.periodBtnText, { color: colors.textSecondary }, selectedPeriod === 'monthly' && { color: '#fff', fontWeight: '700' }]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, selectedPeriod === 'semi_annual' && { backgroundColor: colors.accent }]}
            onPress={() => {
              setSelectedPeriod('semi_annual');
              setSelectedTierId('unlimited');
            }}
          >
            <Text style={[styles.periodBtnText, { color: colors.textSecondary }, selectedPeriod === 'semi_annual' && { color: '#fff', fontWeight: '700' }]}>
              Semi-Annual
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.saveBadgeText, { color: colors.success }]}>Save</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Semi-annual info */}
        {selectedPeriod === 'semi_annual' && (
          <View style={[styles.semiAnnualInfo, { backgroundColor: colors.success + '10', borderColor: colors.success + '30' }]}>
            <Icon name="info" size={16} color={colors.success} />
            <Text style={[styles.semiAnnualInfoText, { color: colors.text }]}>
              Unlimited plan billed every 6 months. {SEMI_ANNUAL_PLAN.savings}.
              Equivalent to ${SEMI_ANNUAL_PLAN.monthlyEquivalent}/mo.
            </Text>
          </View>
        )}

        {/* Tier Cards */}
        {selectedPeriod === 'monthly' ? (
          SUBSCRIPTION_TIERS.map(tier => {
            const isSelected = selectedTierId === tier.id;
            const dynamicPlan = plans.find(p => p.tierId === tier.id && p.period === 'monthly');
            const priceStr = dynamicPlan?.priceString ?? `$${tier.monthlyPrice}`;

            return (
              <TouchableOpacity
                key={tier.id}
                style={[
                  styles.tierCard,
                  { backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border },
                  isSelected && { borderWidth: 2 },
                  tier.highlight && !isSelected && { borderColor: colors.accent + '40' },
                ]}
                onPress={() => setSelectedTierId(tier.id)}
                activeOpacity={0.7}
              >
                <View style={styles.tierCardHeader}>
                  <View style={styles.tierNameRow}>
                    {isSelected && (
                      <View style={[styles.radioSelected, { borderColor: colors.accent, backgroundColor: colors.accent }]}>
                        <Icon name="check" size={12} color="#fff" />
                      </View>
                    )}
                    {!isSelected && (
                      <View style={[styles.radioUnselected, { borderColor: colors.border }]} />
                    )}
                    <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
                    {tier.highlight && (
                      <View style={[styles.popularBadge, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.popularBadgeText, { color: colors.accent }]}>Popular</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={[styles.tierPrice, { color: colors.text }]}>{priceStr}</Text>
                    <Text style={[styles.tierPricePeriod, { color: colors.textSecondary }]}>/mo</Text>
                  </View>
                </View>
                <Text style={[styles.tierSeats, { color: colors.textSecondary }]}>{tier.seatLabel}</Text>
                <View style={styles.tierFeatures}>
                  {tier.features.map((f, i) => (
                    <View key={i} style={styles.tierFeatureRow}>
                      <Icon name="check" size={14} color={colors.accent} />
                      <Text style={[styles.tierFeatureText, { color: colors.text }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          // Semi-annual: single unlimited card
          <View style={[styles.tierCard, { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 2 }]}>
            <View style={styles.tierCardHeader}>
              <View style={styles.tierNameRow}>
                <View style={[styles.radioSelected, { borderColor: colors.accent, backgroundColor: colors.accent }]}>
                  <Icon name="check" size={12} color="#fff" />
                </View>
                <Text style={[styles.tierName, { color: colors.text }]}>Unlimited</Text>
                <View style={[styles.popularBadge, { backgroundColor: colors.success + '15' }]}>
                  <Text style={[styles.popularBadgeText, { color: colors.success }]}>Best Value</Text>
                </View>
              </View>
              <View style={styles.priceRow}>
                <Text style={[styles.tierPrice, { color: colors.text }]}>
                  {semiAnnualPlan?.priceString ?? `$${SEMI_ANNUAL_PLAN.price}`}
                </Text>
                <Text style={[styles.tierPricePeriod, { color: colors.textSecondary }]}>/6mo</Text>
              </View>
            </View>
            <Text style={[styles.tierSeats, { color: colors.textSecondary }]}>Unlimited seats</Text>
            <View style={styles.tierFeatures}>
              {SUBSCRIPTION_TIERS[3].features.map((f, i) => (
                <View key={i} style={styles.tierFeatureRow}>
                  <Icon name="check" size={14} color={colors.accent} />
                  <Text style={[styles.tierFeatureText, { color: colors.text }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* High-value disclaimer */}
        {isHighValue && (
          <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}>
            <Icon name="alert-triangle" size={16} color={colors.warning} />
            <Text style={[styles.disclaimerText, { color: colors.text }]}>
              {HIGH_VALUE_DISCLAIMER}
            </Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.primaryButton, {
            backgroundColor: colors.accent,
            opacity: isLoading ? 0.6 : 1,
          }]}
          onPress={handleSubscribe}
          disabled={isLoading}
        >
          {isLoading || plansLoading ? (
            <ActivityIndicator size="small" color={colors.textLight} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.textLight }]}>
              {subscription.isSubscribed ? 'Update Subscription' : `Subscribe ${displayPrice}${displayPeriodLabel}`}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryButton, {backgroundColor: colors.surface}]} onPress={handleRestore} disabled={isLoading}>
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {isFromRegistration && (
          <View style={styles.skipSection}>
            <TouchableOpacity onPress={handleNavigateAway}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                Continue with Free Plan
              </Text>
            </TouchableOpacity>
            <Text style={[styles.freemiumHint, { color: colors.textSecondary }]}>
              Free plan: {FREEMIUM_LIMITS.maxJobs} jobs, {FREEMIUM_LIMITS.maxClients} clients, {FREEMIUM_LIMITS.maxInventoryItems} inventory items, no team members
            </Text>
          </View>
        )}

        <Text style={[styles.legalText, { color: colors.textSecondary }]}>
          Payment will be charged to your App Store account. Subscription
          automatically renews unless cancelled at least 24 hours
          before the end of the current period.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  planTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  planDescription: {
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  periodToggle: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: 4,
    marginBottom: theme.spacing.md,
  },
  periodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 6,
  },
  periodBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  saveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  semiAnnualInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  semiAnnualInfoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  tierCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  radioSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnselected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  tierName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  popularBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tierPrice: {
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  tierPricePeriod: {
    fontSize: theme.fontSize.sm,
    marginLeft: 2,
  },
  tierSeats: {
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
    marginLeft: 34,
  },
  tierFeatures: {
    gap: 8,
    marginLeft: 34,
  },
  tierFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  tierFeatureText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  disclaimerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  primaryButton: {
    paddingVertical: theme.spacing.md + 2,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: theme.spacing.sm,
  },
  primaryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  skipSection: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  skipText: {
    fontSize: theme.fontSize.md,
    fontWeight: '500',
    paddingVertical: theme.spacing.sm,
  },
  freemiumHint: {
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    marginTop: 2,
  },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
});
