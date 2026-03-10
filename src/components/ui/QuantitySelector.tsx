import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// Percentage steps for quick selection
const PERCENTAGE_STEPS = [0, 25, 50, 75, 100] as const;
type PercentageStep = (typeof PERCENTAGE_STEPS)[number];

export interface QuantitySelectorProps {
    /** Current percentage value (0-100) */
    value: number;
    /** Maximum quantity available */
    maxQty: number;
    /** Callback when value changes */
    onChange: (percentage: number, absoluteQty: number) => void;
    /** Whether to show remaining quantity label */
    showRemaining?: boolean;
    /** Custom label for remaining (default: "Remaining") */
    remainingLabel?: string;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Compact mode for inline usage */
    compact?: boolean;
}

/**
 * QuantitySelector - A touch-friendly percentage selector component
 * 
 * Used for:
 * - Job completion (marking inventory used/remaining)
 * - Estimate creation (selecting quantity from inventory)
 * - Any percentage-based quantity selection
 */
export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
    value,
    maxQty,
    onChange,
    showRemaining = true,
    remainingLabel = 'Remaining',
    disabled = false,
    compact = false,
}) => {
    const {colors} = useTheme();
    // Calculate absolute quantity from percentage
    const absoluteQty = useMemo(() => {
        return Math.round((value / 100) * maxQty);
    }, [value, maxQty]);

    // Find the closest step to current value
    const activeStep = useMemo(() => {
        return PERCENTAGE_STEPS.reduce((prev, curr) =>
            Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        );
    }, [value]);

    // Handle step selection
    const handleStepPress = useCallback(
        (step: PercentageStep) => {
            if (disabled) return;
            const newAbsoluteQty = Math.round((step / 100) * maxQty);
            onChange(step, newAbsoluteQty);
        },
        [disabled, maxQty, onChange]
    );

    return (
        <View style={[styles.container, {backgroundColor: colors.surface}, compact && styles.containerCompact]}>
            {/* Percentage Chips */}
            <View style={styles.chipsContainer}>
                {PERCENTAGE_STEPS.map((step) => {
                    const isActive = activeStep === step;
                    return (
                        <TouchableOpacity
                            key={step}
                            style={[
                                styles.chip,
                                {backgroundColor: colors.background, borderColor: colors.border},
                                compact && styles.chipCompact,
                                isActive && [styles.chipActive, {backgroundColor: colors.accent}],
                                disabled && styles.chipDisabled,
                            ]}
                            onPress={() => handleStepPress(step)}
                            activeOpacity={disabled ? 1 : 0.7}
                            disabled={disabled}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    {color: colors.text},
                                    compact && styles.chipTextCompact,
                                    isActive && [styles.chipTextActive, {color: colors.textLight}],
                                    disabled && [styles.chipTextDisabled, {color: colors.textSecondary}],
                                ]}
                            >
                                {step}%
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Remaining Label */}
            {showRemaining && (
                <View style={[styles.remainingContainer, compact && styles.remainingContainerCompact]}>
                    <Text style={[styles.remainingLabel, {color: colors.textSecondary}, compact && styles.remainingLabelCompact]}>
                        {remainingLabel}:
                    </Text>
                    <Text style={[styles.remainingValue, {color: colors.text}, compact && styles.remainingValueCompact]}>
                        {absoluteQty} of {maxQty}
                    </Text>
                </View>
            )}
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
    chipsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    chip: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.borderRadius.md,

        borderWidth: 1.5,

        alignItems: 'center',
        justifyContent: 'center',
    },
    chipCompact: {
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: 2,
        borderRadius: theme.borderRadius.sm,
    },
    chipActive: {
  },
    chipDisabled: {
        opacity: 0.5,
    },
    chipText: {
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold,

    },
    chipTextCompact: {
        fontSize: theme.fontSize.xs,
    },
    chipTextActive: {
  },
    chipTextDisabled: {
  },
    remainingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    remainingContainerCompact: {
        marginTop: theme.spacing.xs,
    },
    remainingLabel: {
        fontSize: theme.fontSize.sm,

    },
    remainingLabelCompact: {
        fontSize: theme.fontSize.xs,
    },
    remainingValue: {
        fontSize: theme.fontSize.md,
        fontWeight: theme.fontWeight.semibold,

    },
    remainingValueCompact: {
        fontSize: theme.fontSize.sm,
    },
});

export default QuantitySelector;
