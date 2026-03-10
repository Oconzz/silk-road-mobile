import React, { memo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { squarePaymentService, Payment } from '../services/api/domain/squarePayment';

export interface PaymentHistorySectionProps {
  jobId: string;
  refreshKey?: number;
  onPaymentPress?: (payment: Payment) => void;
}

const formatCurrency = (amount: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusConfig = (status: Payment['status'], colors: any) => {
  switch (status) {
    case 'completed':
      return { icon: 'check-circle', color: colors.success, label: 'Completed' };
    case 'failed':
      return { icon: 'x-circle', color: colors.error, label: 'Failed' };
    case 'cancelled':
      return { icon: 'slash', color: colors.warning, label: 'Cancelled' };
    default:
      return { icon: 'clock', color: colors.textSecondary, label: 'Pending' };
  }
};

const PaymentItem = memo<{ payment: Payment; onPress?: (payment: Payment) => void }>(
  ({ payment, onPress }) => {
    const { colors } = useTheme();
    const statusConfig = getStatusConfig(payment.status, colors);

    return (
      <TouchableOpacity         style={[styles.paymentItem, {backgroundColor: colors.surface}]}
        onPress={() => onPress?.(payment)}
        activeOpacity={0.7}
      >
        <View style={styles.paymentLeft}>
          <View style={[styles.statusIcon, { backgroundColor: statusConfig.color + '20' }]}>
            <Icon name={statusConfig.icon} size={16} color={statusConfig.color} />
          </View>
          <View style={styles.paymentInfo}>
            <Text style={[styles.paymentAmount, {color: colors.text}]}>
              {formatCurrency(payment.amount, payment.currency)}
            </Text>
            <Text style={[styles.paymentDate, {color: colors.textSecondary}]}>{formatDate(payment.createDatetime)}</Text>
          </View>
        </View>
        <View style={styles.paymentRight}>
          {payment.paymentMethod === 'payment_link' ? (
            <View style={styles.paymentMethodRow}>
              <Icon name="link" size={12} color={colors.textSecondary} />
              <Text style={[styles.cardInfo, {color: colors.textSecondary}]}>Payment Link</Text>
            </View>
          ) : payment.cardBrand && payment.lastFourDigits ? (
            <Text style={[styles.cardInfo, {color: colors.textSecondary}]}>
              ****{payment.lastFourDigits}
            </Text>
          ) : null}
          <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
);

PaymentItem.displayName = 'PaymentItem';

export const PaymentHistorySection = memo<PaymentHistorySectionProps>(
  ({ jobId, refreshKey, onPaymentPress }) => {
    const { colors } = useTheme();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPayments = useCallback(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await squarePaymentService.getJobPayments(jobId);
        setPayments(data);
      } catch (err: any) {
        console.error('Failed to load payments:', err);
        setError(err.message || 'Failed to load payments');
      } finally {
        setIsLoading(false);
      }
    }, [jobId]);

    useEffect(() => {
      loadPayments();
    }, [loadPayments, refreshKey]);

    const handlePaymentLinkPress = useCallback(async (payment: Payment) => {
      const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];

      if (payment.squarePaymentLinkUrl) {
        options.push({
          text: 'Share Link Again',
          onPress: async () => {
            try {
              await Share.share({
                message: `Payment link: ${payment.squarePaymentLinkUrl}`,
                url: payment.squarePaymentLinkUrl!,
                title: 'Payment Link',
              });
            } catch (e) {
              // User cancelled share
            }
          },
        });
      }

      options.push({
        text: 'Check Payment Status',
        onPress: async () => {
          try {
            const updated = await squarePaymentService.checkPaymentLinkStatus(payment.id);
            if (updated && updated.status !== payment.status) {
              Alert.alert('Status Updated', `Payment status: ${updated.status}`);
              loadPayments();
            } else {
              Alert.alert('Status', `Payment is still ${payment.status}`);
            }
          } catch (e) {
            Alert.alert('Error', 'Could not check payment status');
          }
        },
      });

      options.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert(
        'Payment Link',
        `$${payment.amount.toFixed(2)} — ${payment.status}`,
        options
      );
    }, [loadPayments]);

    const handlePress = useCallback((payment: Payment) => {
      if (payment.paymentMethod === 'payment_link' && payment.status === 'pending') {
        handlePaymentLinkPress(payment);
      } else {
        onPaymentPress?.(payment);
      }
    }, [handlePaymentLinkPress, onPaymentPress]);

    const calculateTotal = useCallback(() => {
      return payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);
    }, [payments]);

    if (isLoading) {
      return (
        <View style={[styles.loadingContainer, {backgroundColor: colors.surface}]}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.errorContainer, {backgroundColor: colors.error + '10'}]}>
          <Icon name="alert-circle" size={20} color={colors.error} />
          <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
          <TouchableOpacity onPress={loadPayments}>
            <Text style={[styles.retryText, {color: colors.accent}]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (payments.length === 0) {
      return (
        <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
          <Icon name="credit-card" size={24} color={colors.textSecondary} />
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No payments recorded</Text>
        </View>
      );
    }

    const total = calculateTotal();

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Payment History</Text>
          {total > 0 && (
            <Text style={[styles.totalAmount, {color: colors.success}]}>
              Total: {formatCurrency(total)}
            </Text>
          )}
        </View>
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PaymentItem payment={item} onPress={handlePress} />
          )}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={[styles.separator, {backgroundColor: colors.border}]} />}
        />
      </View>
    );
  }
);

PaymentHistorySection.displayName = 'PaymentHistorySection';

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  totalAmount: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  loadingContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
  },
  errorText: {
    flex: 1,
    fontSize: theme.fontSize.sm,

  },
  retryText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,

  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    gap: 2,
  },
  paymentAmount: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  paymentDate: {
    fontSize: theme.fontSize.xs,

  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardInfo: {
    fontSize: theme.fontSize.xs,

  },
  statusLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  separator: {
    height: 1,

  },
});
