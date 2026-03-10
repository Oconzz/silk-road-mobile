import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { Payment, PaymentStatus } from '../../types/payment';

export interface PaymentConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  payment: Payment | null;
  jobTitle?: string;
}

const getStatusConfig = (status: PaymentStatus, colors: any) => {
  switch (status) {
    case 'completed':
      return {
        icon: 'check-circle',
        color: colors.success,
        title: 'Payment Successful',
        message: 'The payment has been processed successfully.',
      };
    case 'failed':
      return {
        icon: 'x-circle',
        color: colors.error,
        title: 'Payment Failed',
        message: 'The payment could not be processed.',
      };
    case 'cancelled':
      return {
        icon: 'slash',
        color: colors.warning,
        title: 'Payment Cancelled',
        message: 'The payment was cancelled.',
      };
    default:
      return {
        icon: 'clock',
        color: colors.textSecondary,
        title: 'Payment Pending',
        message: 'The payment is being processed.',
      };
  }
};

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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PaymentConfirmationModal = memo<PaymentConfirmationModalProps>(
  ({ visible, onClose, payment, jobTitle }) => {
    const {colors} = useTheme();
    if (!payment) return null;

    const statusConfig = getStatusConfig(payment.status, colors);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContainer, {backgroundColor: colors.surface}]}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: statusConfig.color + '20' },
                  ]}
                >
                  <Icon
                    name={statusConfig.icon}
                    size={40}
                    color={statusConfig.color}
                  />
                </View>

                <Text style={[styles.title, {color: colors.text}]}>{statusConfig.title}</Text>
                <Text style={[styles.message, {color: colors.textSecondary}]}>{statusConfig.message}</Text>

                <View style={styles.amountContainer}>
                  <Text style={[styles.amountLabel, {color: colors.textSecondary}]}>Amount</Text>
                  <Text
                    style={[styles.amount, { color: statusConfig.color }]}
                  >
                    {formatCurrency(payment.amount, payment.currency)}
                  </Text>
                </View>

                <View style={[styles.detailsContainer, {backgroundColor: colors.surface}]}>
                  {jobTitle && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Job</Text>
                      <Text style={[styles.detailValue, {color: colors.text}]} numberOfLines={1}>
                        {jobTitle}
                      </Text>
                    </View>
                  )}

                  {payment.cardBrand && payment.lastFourDigits && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Card</Text>
                      <View style={styles.cardInfo}>
                        <Icon
                          name="credit-card"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={[styles.detailValue, {color: colors.text}]}>
                          {payment.cardBrand} ****{payment.lastFourDigits}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Date</Text>
                    <Text style={[styles.detailValue, {color: colors.text}]}>
                      {formatDate(
                        payment.completedDatetime || payment.createDatetime
                      )}
                    </Text>
                  </View>

                  {payment.failureReason && (
                    <View style={[styles.errorContainer, {backgroundColor: `${colors.error}10`}]}>
                      <Icon
                        name="alert-triangle"
                        size={16}
                        color={colors.error}
                      />
                      <Text style={[styles.errorText, {color: colors.error}]}>
                        {payment.failureReason}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.closeButton, {backgroundColor: colors.accent}]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.closeButtonText, {color: colors.textLight}]}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }
);

PaymentConfirmationModal.displayName = 'PaymentConfirmationModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {

    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...theme.shadow.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  message: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  amountLabel: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.xs,
  },
  amount: {
    fontSize: 32,
    fontWeight: theme.fontWeight.bold,
  },
  detailsContainer: {
    width: '100%',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,

  },
  detailValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    maxWidth: '60%',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,

    borderRadius: theme.borderRadius.sm,
  },
  errorText: {
    flex: 1,
    fontSize: theme.fontSize.sm,

  },
  closeButton: {
    width: '100%',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',

  },
  closeButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
});
