import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { subscriptionService } from '../services/subscriptionService';
import { PRICING, getTierById } from '../types/subscription';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type ManagePlanScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ManagePlan'>;
};

export const ManagePlanScreen: React.FC<ManagePlanScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const { subscription, refreshSubscription, presentCustomerCenter } = useSubscription();
  const [isRestoring, setIsRestoring] = useState(false);

  // If no active plan and not loading, redirect directly to PlanSelection
  useEffect(() => {
    if (!subscription.isLoading && !subscription.isSubscribed) {
      navigation.replace('PlanSelection', { fromRegistration: false });
    }
  }, [subscription.isLoading, subscription.isSubscribed, navigation]);

  const handleChangePlan = useCallback(() => {
    navigation.navigate('PlanSelection', { fromRegistration: false });
  }, [navigation]);

  const handleCustomerCenter = useCallback(async () => {
    await presentCustomerCenter();
  }, [presentCustomerCenter]);

  const handleRestorePurchases = useCallback(async () => {
    setIsRestoring(true);
    try {
      await subscriptionService.restorePurchases();
      await refreshSubscription();
      Alert.alert('Success', 'Purchases restored successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases.');
    } finally {
      setIsRestoring(false);
    }
  }, [refreshSubscription]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) { return 'N/A'; }
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.surface}, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Plan</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {subscription.isLoading ? (
          <View style={[styles.loadingContainer, {backgroundColor: colors.surface}]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading subscription...
            </Text>
          </View>
        ) : subscription.isSubscribed ? (
          <>
            {/* Active Plan Card */}
            <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
              <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15` }]}>
                <Icon name="check-circle" size={14} color={colors.success} />
                <Text style={[styles.statusText, { color: colors.success }]}>Active</Text>
              </View>

              <Text style={[styles.planName, { color: colors.text }]}>SilkRoad Pro</Text>

              <View style={styles.planDetails}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Plan</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {getTierById(subscription.tierId).name}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Billing</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {subscription.billingPeriod === 'semi_annual' ? 'Semi-Annual' : 'Monthly'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {subscription.billingPeriod === 'semi_annual' ? 'Effective Monthly' : 'Monthly Cost'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    ${subscription.monthlyPrice.toFixed(2)}/mo
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {subscription.willRenew ? 'Renews On' : 'Expires On'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDate(subscription.expirationDate)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Auto-Renew</Text>
                  <Text style={[styles.detailValue, { color: subscription.willRenew ? colors.success : colors.warning }]}>
                    {subscription.willRenew ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Seat Counter Card */}
            <View style={[styles.seatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.seatHeader}>
                <Icon name="users" size={20} color={colors.accent} />
                <Text style={[styles.seatTitle, { color: colors.text }]}>Team Seats</Text>
              </View>

              <View style={styles.seatCountRow}>
                <View style={styles.seatCountBlock}>
                  <Text style={[styles.seatCountNumber, { color: colors.accent }]}>
                    {subscription.totalSeats}
                  </Text>
                  <Text style={[styles.seatCountLabel, { color: colors.textSecondary }]}>
                    Total Seats
                  </Text>
                </View>

                <View style={[styles.seatDivider, { backgroundColor: colors.border }]} />

                <View style={styles.seatCountBlock}>
                  <Text style={[styles.seatCountNumber, { color: colors.text }]}>
                    {getTierById(subscription.tierId).name}
                  </Text>
                  <Text style={[styles.seatCountLabel, { color: colors.textSecondary }]}>
                    Tier
                  </Text>
                </View>
              </View>

              <Text style={[styles.seatInfo, { color: colors.textSecondary }]}>
                {subscription.isUnlimited
                  ? 'Your plan includes unlimited team seats.'
                  : `Your plan includes ${subscription.totalSeats} seat${subscription.totalSeats !== 1 ? 's' : ''}. Upgrade for more.`}
              </Text>

              {!subscription.isUnlimited && (
                <TouchableOpacity                   style={[styles.addSeatsButton, {backgroundColor: colors.accent}, { borderColor: colors.accent }]}
                  onPress={handleChangePlan}
                >
                  <Icon name="arrow-up" size={16} color={colors.accent} />
                  <Text style={[styles.addSeatsText, { color: colors.accent }]}>
                    Upgrade Plan
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actionsSection}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleChangePlan}
              >
                <Icon name="edit-3" size={20} color={colors.accent} />
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Change Plan</Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    Adjust seat packs or upgrade
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleCustomerCenter}
              >
                <Icon name="settings" size={20} color={colors.accent} />
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Manage Subscription</Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    Cancel, request refund, or get help
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleRestorePurchases}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Icon name="refresh-cw" size={20} color={colors.accent} />
                )}
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>Restore Purchases</Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    Sync purchases from another device
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* No Active Plan */
          <View style={[styles.noPlanContainer, {backgroundColor: colors.surface}]}>
            <View style={[styles.noPlanIcon, { backgroundColor: `${colors.accent}10` }]}>
              <Icon name="zap" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.noPlanTitle, { color: colors.text }]}>No Active Plan</Text>
            <Text style={[styles.noPlanDescription, { color: colors.textSecondary }]}>
              Subscribe to SilkRoad Pro to unlock all features for your business.
            </Text>

            <TouchableOpacity
              style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
              onPress={handleChangePlan}
            >
              <Text style={[styles.subscribeButtonText, { color: colors.textLight }]}>
                Choose a Plan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreLink}
              onPress={handleRestorePurchases}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={[styles.restoreLinkText, { color: colors.textSecondary }]}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.xxl * 2,
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
  },
  planCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  planName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
    marginBottom: theme.spacing.lg,
  },
  planDetails: {
    gap: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: theme.fontSize.md,
  },
  detailValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  seatCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  seatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  seatTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  seatCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  seatCountBlock: {
    flex: 1,
    alignItems: 'center',
  },
  seatCountNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  seatCountLabel: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  seatDivider: {
    width: 1,
    height: 40,
  },
  seatInfo: {
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  addSeatsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
  },
  addSeatsText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  actionsSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  actionSubtitle: {
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  noPlanContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl * 2,
  },
  noPlanIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  noPlanTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  noPlanDescription: {
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  subscribeButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  subscribeButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  restoreLink: {
    paddingVertical: theme.spacing.sm,
  },
  restoreLinkText: {
    fontSize: theme.fontSize.sm,
    textDecorationLine: 'underline',
  },
});
