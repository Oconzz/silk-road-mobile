import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { squarePaymentService, Payment } from '../../services/api/domain/squarePayment';

type PaymentMethod = 'pos' | 'payment_link';
type ModalStep = 'select' | 'form';

export interface CollectPaymentButtonProps {
  jobId: string;
  jobTitle: string;
  estimatedTotal: number;
  squareLinked: boolean;
  onPaymentInitiated?: (paymentId: string) => void;
  onPaymentComplete?: (payment: Payment) => void;
  onPaymentLinkCreated?: (paymentId: string, paymentLinkUrl: string) => void;
  disabled?: boolean;
}

export const CollectPaymentButton = memo<CollectPaymentButtonProps>(
  ({
    jobId,
    jobTitle,
    estimatedTotal,
    squareLinked,
    onPaymentInitiated,
    onPaymentComplete,
    onPaymentLinkCreated,
    disabled = false,
  }) => {
    const {colors} = useTheme();
    const [showModal, setShowModal] = useState(false);
    const [modalStep, setModalStep] = useState<ModalStep>('select');
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('pos');
    const [amount, setAmount] = useState(estimatedTotal.toFixed(2));
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handlePress = useCallback(() => {
      if (!squareLinked) {
        Alert.alert(
          'Square Not Connected',
          'Please connect your Square account in Settings to collect payments.',
          [{ text: 'OK' }]
        );
        return;
      }
      setAmount(estimatedTotal.toFixed(2));
      setNotes('');
      setModalStep('select');
      setSelectedMethod('pos');
      setShowModal(true);
    }, [squareLinked, estimatedTotal]);

    const handleSelectMethod = useCallback((method: PaymentMethod) => {
      setSelectedMethod(method);
      setModalStep('form');
    }, []);

    const handleCollectPayment = useCallback(async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await squarePaymentService.initiatePayment({
          jobId,
          amount: parsedAmount,
          notes: notes || undefined,
        });

        onPaymentInitiated?.(result.paymentId);
        setShowModal(false);

        // Open Square POS app via deep link
        const canOpen = await Linking.canOpenURL(result.squarePosUrl);
        if (canOpen) {
          await Linking.openURL(result.squarePosUrl);
        } else {
          Alert.alert(
            'Square POS Not Found',
            'Please install the Square Point of Sale app to collect payments.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Install',
                onPress: () => {
                  const storeUrl =
                    'https://apps.apple.com/app/square-point-of-sale-pos/id335393788';
                  Linking.openURL(storeUrl);
                },
              },
            ]
          );
        }
      } catch (error: any) {
        console.error('Failed to initiate payment:', error);
        Alert.alert('Error', error.message || 'Failed to initiate payment. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, [jobId, amount, notes, onPaymentInitiated]);

    const handleCreatePaymentLink = useCallback(async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await squarePaymentService.createPaymentLink({
          jobId,
          amount: parsedAmount,
          notes: notes || undefined,
        });

        // Close modal and stop loading first
        setShowModal(false);
        setIsLoading(false);

        // Small delay to let the modal fully dismiss before showing Share sheet
        // Without this, the modal animation interferes with the Share sheet presentation
        setTimeout(async () => {
          try {
            await Share.share({
              message: `Payment of $${parsedAmount.toFixed(2)} for ${jobTitle}: ${result.paymentLinkUrl}`,
              url: result.paymentLinkUrl,
              title: 'Payment Link',
            });
          } catch (shareError) {
            // User cancelled the share sheet — that's fine
            console.log('Share dismissed:', shareError);
          }

          // Notify parent after share completes (whether shared or cancelled)
          onPaymentInitiated?.(result.paymentId);
          onPaymentLinkCreated?.(result.paymentId, result.paymentLinkUrl);
        }, 500);
      } catch (error: any) {
        console.error('Failed to create payment link:', error);
        Alert.alert('Error', error.message || 'Failed to create payment link. Please try again.');
        setIsLoading(false);
      }
    }, [jobId, jobTitle, amount, notes, onPaymentInitiated, onPaymentLinkCreated]);

    const handleSubmit = useCallback(async () => {
      if (selectedMethod === 'pos') {
        await handleCollectPayment();
      } else {
        await handleCreatePaymentLink();
      }
    }, [selectedMethod, handleCollectPayment, handleCreatePaymentLink]);

    const handleCancel = useCallback(() => {
      setShowModal(false);
      setModalStep('select');
      setSelectedMethod('pos');
    }, []);

    const handleBack = useCallback(() => {
      setModalStep('select');
    }, []);

    const formatCurrency = (value: string) => {
      const cleaned = value.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
      }
      if (parts[1] && parts[1].length > 2) {
        return parts[0] + '.' + parts[1].slice(0, 2);
      }
      return cleaned;
    };

    const renderMethodSelection = () => (
      <>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, {color: colors.text}]}>Collect Payment</Text>
          <TouchableOpacity onPress={handleCancel}>
            <Icon name="x" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.jobTitle, {color: colors.textSecondary}]}>{jobTitle}</Text>

        <Text style={[styles.selectLabel, {color: colors.text}]}>Choose payment method</Text>

        <TouchableOpacity
          style={[styles.methodCard, {backgroundColor: colors.background, borderColor: colors.border}]}
          onPress={() => handleSelectMethod('pos')}
          activeOpacity={0.7}
        >
          <View style={[styles.methodIconContainer, {backgroundColor: colors.success + '15'}]}>
            <Icon name="credit-card" size={24} color={colors.success} />
          </View>
          <View style={styles.methodInfo}>
            <Text style={[styles.methodTitle, {color: colors.text}]}>Collect via POS</Text>
            <Text style={[styles.methodDescription, {color: colors.textSecondary}]}>
              Open Square POS app to collect payment in person
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodCard, {backgroundColor: colors.background, borderColor: colors.border}]}
          onPress={() => handleSelectMethod('payment_link')}
          activeOpacity={0.7}
        >
          <View style={[styles.methodIconContainer, {backgroundColor: colors.accent + '15'}]}>
            <Icon name="send" size={24} color={colors.accent} />
          </View>
          <View style={styles.methodInfo}>
            <Text style={[styles.methodTitle, {color: colors.text}]}>Send Payment Link</Text>
            <Text style={[styles.methodDescription, {color: colors.textSecondary}]}>
              Create a link to share via SMS, email, or other apps
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </>
    );

    const renderAmountForm = () => (
      <>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderLeft}>
            <TouchableOpacity onPress={handleBack} disabled={isLoading} style={[styles.backButton, {backgroundColor: colors.surface}]}>
              <Icon name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, {color: colors.text}]}>
              {selectedMethod === 'pos' ? 'Collect via POS' : 'Send Payment Link'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleCancel} disabled={isLoading}>
            <Icon name="x" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.jobTitle, {color: colors.textSecondary}]}>{jobTitle}</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, {color: colors.text}]}>Amount</Text>
          <View style={[styles.amountInputContainer, {backgroundColor: colors.background, borderColor: colors.border}]}>
            <Text style={[styles.currencySymbol, {color: colors.text}]}>$</Text>
            <TextInput
              style={[styles.amountInput, {color: colors.text}]}
              value={amount}
              onChangeText={(text) => setAmount(formatCurrency(text))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              editable={!isLoading}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, {color: colors.text}]}>Notes (optional)</Text>
          <TextInput
            style={[styles.notesInput, {backgroundColor: colors.background, borderColor: colors.border, color: colors.text}]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note for this payment..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={2}
            editable={!isLoading}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.collectButton,
              selectedMethod === 'payment_link' && {backgroundColor: colors.accent},
              isLoading && styles.buttonLoading,
            ]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textLight} size="small" />
            ) : (
              <>
                <Icon
                  name={selectedMethod === 'pos' ? 'credit-card' : 'send'}
                  size={18}
                  color={colors.textLight}
                />
                <Text style={[styles.collectButtonText, {color: colors.textLight}]}>
                  {selectedMethod === 'pos' ? 'Open Square POS' : 'Create Payment Link'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isLoading}
          >
            <Text style={[styles.cancelButtonText, {color: colors.textSecondary}]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </>
    );

    return (
      <>
        <TouchableOpacity
          style={[
            styles.button,
            {backgroundColor: colors.success},
            (!squareLinked || disabled) && {backgroundColor: colors.border},
          ]}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Icon
            name="credit-card"
            size={20}
            color={squareLinked ? colors.textLight : colors.textSecondary}
          />
          <Text
            style={[
              styles.buttonText,
              {color: colors.textLight},
              !squareLinked && {color: colors.textSecondary},
            ]}
          >
            Collect Payment
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showModal}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={handleCancel}
        >
          <View style={styles.overlay}>
            <View style={[styles.modalContainer, {backgroundColor: colors.surface}]}>
              {modalStep === 'select' ? renderMethodSelection() : renderAmountForm()}
            </View>
          </View>
        </Modal>
      </>
    );
  }
);

CollectPaymentButton.displayName = 'CollectPaymentButton';

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  buttonDisabled: {
  },
  buttonText: {

    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  buttonTextDisabled: {
  },
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
    maxWidth: 380,
    ...theme.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  jobTitle: {
    fontSize: theme.fontSize.md,

    marginBottom: theme.spacing.lg,
  },
  selectLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing.md,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: theme.fontSize.sm,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
  },
  currencySymbol: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    marginRight: theme.spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    paddingVertical: theme.spacing.md,
  },
  notesInput: {

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,

    minHeight: 60,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cancelButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,

  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  collectButton: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',

    gap: theme.spacing.sm,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  collectButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
});
