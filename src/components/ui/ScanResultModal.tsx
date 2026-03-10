import React, {memo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

interface ScanResultModalProps {
  visible: boolean;
  code: string;
  codeType: string;
  productName?: string;
  productDescription?: string;
  onUseCode: () => void;
  onScanAgain: () => void;
}

export const ScanResultModal = memo<ScanResultModalProps>(({
  visible,
  code,
  codeType,
  productName,
  productDescription,
  onUseCode,
  onScanAgain,
}) => {
  const {colors} = useTheme();
  const hasProductInfo = !!productName;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onScanAgain}>
      <TouchableWithoutFeedback onPress={() => {}}>
        <View style={styles.overlay}>
          <View style={[styles.container, {backgroundColor: colors.surface}]}>
            {/* Header */}
            <View style={[styles.header, {backgroundColor: colors.surface}]}>
              <View style={[styles.iconContainer, {backgroundColor: `${colors.accent}15`}]}>
                <Icon name="check-circle" size={32} color={colors.accent} />
              </View>
              <Text style={[styles.title, {color: colors.text}]}>Barcode Scanned</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {hasProductInfo && (
                <View style={[styles.productContainer, {backgroundColor: `${colors.accent}10`, borderLeftColor: colors.accent}]}>
                  <Text style={[styles.productName, {color: colors.text}]}>{productName}</Text>
                  {productDescription && (
                    <Text style={[styles.productDescription, {color: colors.textSecondary}]} numberOfLines={3}>
                      {productDescription}
                    </Text>
                  )}
                </View>
              )}
              <View style={[styles.codeContainer, {backgroundColor: colors.background}]}>
                <Text style={[styles.codeLabel, {color: colors.textSecondary}]}>Code</Text>
                <Text style={[styles.codeValue, {color: colors.text}]} numberOfLines={2}>
                  {code}
                </Text>
              </View>
              <View style={[styles.typeContainer, {backgroundColor: colors.background}]}>
                <Text style={[styles.typeLabel, {color: colors.textSecondary}]}>Type</Text>
                <Text style={[styles.typeValue, {color: colors.text}]}>{codeType}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={[styles.actions, {borderTopColor: colors.border}]}>
              <TouchableOpacity                 style={[styles.secondaryButton, {backgroundColor: colors.surface}, {borderRightColor: colors.border}]}
                onPress={onScanAgain}
                activeOpacity={0.7}>
                <Icon name="refresh-cw" size={18} color={colors.text} />
                <Text style={[styles.secondaryButtonText, {color: colors.text}]}>Scan Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.primaryButton, {backgroundColor: colors.accent}]}
                onPress={onUseCode}
                activeOpacity={0.7}>
                <Icon name="check" size={18} color={colors.surface} />
                <Text style={[styles.primaryButtonText, {color: colors.textLight}]}>Use This Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

ScanResultModal.displayName = 'ScanResultModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {

    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,

    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  codeContainer: {

    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  codeLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,

    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    fontFamily: 'monospace',
  },
  typeContainer: {

    borderRadius: 12,
    padding: theme.spacing.md,
  },
  typeLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,

    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  typeValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  productContainer: {

    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,

  },
  productName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

    marginBottom: 4,
  },
  productDescription: {
    fontSize: theme.fontSize.sm,

    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,

  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: 8,
    borderRightWidth: 1,

  },
  secondaryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,

    gap: 8,
  },
  primaryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
});
