import React, { useCallback, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export interface PercentageSliderProps {
  /** Current percentage value (0-100) */
  value: number;
  /** Maximum quantity available */
  maxQty: number;
  /** Callback when value changes */
  onChange: (percentage: number, absoluteQty: number) => void;
  /** Label for "allocated" portion (primary) */
  usedLabel?: string;
  /** Label for "remaining" portion */
  remainingLabel?: string;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
  /** Show quantity breakdown */
  showBreakdown?: boolean;
}

/**
 * PercentageSlider - Quantity-primary slider with percentage secondary
 * 
 * Features:
 * - Quantity is PRIMARY (big number)
 * - Percentage is SECONDARY (smaller, gray)
 * - Double-tap on quantity to edit directly
 * - Slider controls quantity
 */
export const PercentageSlider: React.FC<PercentageSliderProps> = ({
  value,
  maxQty,
  onChange,
  usedLabel = 'Allocating',
  remainingLabel = 'Available',
  disabled = false,
  compact = false,
  showBreakdown = true,
}) => {
  const {colors} = useTheme();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editValue, setEditValue] = useState('');
  const lastTapRef = useRef<number>(0);

  // Calculate absolute quantities
  const allocatedQty = useMemo(() => Math.round((value / 100) * maxQty), [value, maxQty]);
  const remainingQty = useMemo(() => maxQty - allocatedQty, [maxQty, allocatedQty]);

  // Handle slider change - now based on quantity steps
  const handleValueChange = useCallback(
    (newValue: number) => {
      // newValue is still 0-100 percentage from slider
      const rounded = Math.round(newValue);
      const absoluteQty = Math.round((rounded / 100) * maxQty);
      onChange(rounded, absoluteQty);
    },
    [maxQty, onChange]
  );

  // Handle tap on quantity to edit directly
  const handleQuantityPress = useCallback(() => {
    setEditValue(String(allocatedQty));
    setShowEditModal(true);
  }, [allocatedQty]);

  // Handle manual quantity edit
  const handleEditConfirm = useCallback(() => {
    const newQty = parseInt(editValue, 10);
    if (!isNaN(newQty) && newQty >= 0 && newQty <= maxQty) {
      const newPercentage = Math.round((newQty / maxQty) * 100);
      onChange(newPercentage, newQty);
    }
    setShowEditModal(false);
  }, [editValue, maxQty, onChange]);

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}, compact && styles.containerCompact]}>
      {/* Quantity Display (PRIMARY) - Double-tap to edit */}
      <TouchableOpacity 
        style={styles.quantityRow} 
        onPress={handleQuantityPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.quantityValue, compact && styles.quantityValueCompact, {color: colors.accent}]}>
          {allocatedQty}
        </Text>
        <Text style={[styles.quantityLabel, {color: colors.text}]}>{usedLabel}</Text>
      </TouchableOpacity>

      {/* Percentage Display (SECONDARY) */}
      <Text style={[styles.percentageSecondary, {color: colors.textSecondary}]}>({value}%)</Text>

      {/* Slider */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={maxQty > 0 ? (100 / maxQty) : 1}
        value={value}
        onValueChange={handleValueChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
        disabled={disabled}
      />

      {/* Quantity Breakdown */}
      {showBreakdown && (
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, {backgroundColor: colors.accent}]} />
            <Text style={[styles.breakdownLabel, {color: colors.textSecondary}]}>{usedLabel}:</Text>
            <Text style={[styles.breakdownValue, {color: colors.text}]}>{allocatedQty}</Text>
          </View>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownDot, {backgroundColor: colors.border}]} />
            <Text style={[styles.breakdownLabel, {color: colors.textSecondary}]}>{remainingLabel}:</Text>
            <Text style={[styles.breakdownValue, {color: colors.text}]}>{remainingQty}</Text>
          </View>
        </View>
      )}

      {/* Hint for tap-to-edit */}
      <Text style={[styles.editHint, {color: colors.textSecondary}]}>Tap quantity to edit</Text>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
          <Pressable style={[styles.modalContent, {backgroundColor: colors.surface}]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>Enter Quantity</Text>
            <Text style={[styles.modalSubtitle, {color: colors.textSecondary}]}>Max: {maxQty}</Text>
            <TextInput
              style={[styles.modalInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
              maxLength={String(maxQty).length + 1}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalCancelBtn, {backgroundColor: colors.surface}, {borderColor: colors.border}]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.modalCancelText, {color: colors.textSecondary}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, {backgroundColor: colors.accent}]}
                onPress={handleEditConfirm}
              >
                <Text style={[styles.modalConfirmText, {color: colors.textLight}]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: theme.spacing.sm,
  },
  containerCompact: {
    paddingVertical: theme.spacing.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quantityValue: {
    fontSize: 32,
    fontWeight: theme.fontWeight.bold,

    marginRight: theme.spacing.xs,
  },
  quantityValueCompact: {
    fontSize: theme.fontSize.xxl,
  },
  quantityLabel: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
  percentageSecondary: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.sm,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  allocatedDot: {
  },
  remainingDot: {
  },
  breakdownLabel: {
    fontSize: theme.fontSize.sm,

  },
  breakdownValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },
  editHint: {
    fontSize: theme.fontSize.xs,

    textAlign: 'center',
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.md,
  },
  modalInput: {

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    textAlign: 'center',
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: theme.fontSize.md,

  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
});

export default PercentageSlider;
