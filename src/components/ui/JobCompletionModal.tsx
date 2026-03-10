import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import type { JobLineItem } from '../../types/job';

export interface JobCompletionModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (updates: LineItemUsageUpdate[]) => void;
    lineItems: JobLineItem[];
    jobTitle: string;
}

export interface LineItemUsageUpdate {
    itemId: string;
    inventoryId?: string;
    usedPercentage: number;
    usedQty: number;
    returnedQty: number;
}

export type AllocationUpdate = LineItemUsageUpdate;

/**
 * JobCompletionModal - Compact modal for marking job complete with usage tracking
 * Items are collapsible, compact, and in a scrollable list.
 */
export const JobCompletionModal: React.FC<JobCompletionModalProps> = ({
    visible,
    onClose,
    onConfirm,
    lineItems,
    jobTitle,
}) => {
    const {colors} = useTheme();
    const materialItems = useMemo(() => 
        lineItems.filter(item => item.type !== 'labor'),
    [lineItems]);

    const [usageMap, setUsageMap] = useState<Record<string, number>>({});
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
    const [_editingItem, _setEditingItem] = useState<string | null>(null);
    const lastTapRef = useRef<Record<string, number>>({});

    // Reset on visibility change
    useMemo(() => {
        if (visible) {
            const initial: Record<string, number> = {};
            const expanded: Record<string, boolean> = {};
            materialItems.forEach((item, index) => {
                initial[item.id] = 100;
                expanded[item.id] = index === 0; // First item expanded by default
            });
            setUsageMap(initial);
            setExpandedItems(expanded);
        }
    }, [visible, materialItems]);

    const toggleItem = useCallback((itemId: string) => {
        setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    }, []);

    const handleUsageChange = useCallback((itemId: string, percentage: number) => {
        setUsageMap(prev => ({ ...prev, [itemId]: percentage }));
    }, []);

    // Double tap to edit quantity
    const handleDoubleTap = useCallback((itemId: string, qty: number) => {
        const now = Date.now();
        const lastTap = lastTapRef.current[itemId] || 0;
        
        if (now - lastTap < 300) {
            // Double tap detected - show edit prompt
            Alert.prompt(
                'Edit Quantity',
                `Enter quantity used (max ${qty})`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'OK', 
                        onPress: (value: string | undefined) => {
                            const numValue = parseInt(value || '0', 10);
                            if (numValue >= 0 && numValue <= qty) {
                                const percent = qty > 0 ? Math.round((numValue / qty) * 100) : 0;
                                handleUsageChange(itemId, percent);
                            }
                        }
                    }
                ],
                'plain-text',
                String(Math.round((usageMap[itemId] ?? 100) / 100 * qty))
            );
        }
        lastTapRef.current[itemId] = now;
    }, [handleUsageChange, usageMap]);

    const summary = useMemo(() => {
        let totalUsed = 0;
        materialItems.forEach(item => {
            const qty = item.quantity || 0;
            const usedPercent = usageMap[item.id] ?? 100;
            totalUsed += Math.round((usedPercent / 100) * qty);
        });
        return { totalUsed };
    }, [materialItems, usageMap]);

    const handleConfirm = useCallback(() => {
        const updates: LineItemUsageUpdate[] = materialItems.map(item => {
            const qty = item.quantity || 0;
            const usedPercent = usageMap[item.id] ?? 100;
            const usedQty = Math.round((usedPercent / 100) * qty);
            return {
                itemId: item.id,
                inventoryId: item.inventoryId,
                usedPercentage: usedPercent,
                usedQty,
                returnedQty: qty - usedQty,
            };
        });
        onConfirm(updates);
    }, [materialItems, usageMap, onConfirm]);

    // No material items - simple completion
    if (materialItems.length === 0) {
        return (
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <View style={styles.overlay}>
                    <View style={[styles.content, {backgroundColor: colors.surface}]}>
                        <View style={[styles.iconWrap, {backgroundColor: `${colors.accent}15`}]}>
                            <Icon name="check-circle" size={40} color={colors.success} />
                        </View>
                        <Text style={[styles.title, {color: colors.text}]}>Complete Job?</Text>
                        <Text style={[styles.subtitle, {color: colors.textSecondary}]}>{jobTitle}</Text>
                        <Text style={[styles.message, {color: colors.textSecondary}]}>
                            Mark this job as completed? Make sure all work has been finished.
                        </Text>
                        <View style={styles.actions}>
                            <TouchableOpacity style={[styles.cancelBtn, {backgroundColor: colors.surface}, {borderColor: colors.border}]} onPress={onClose}>
                                <Text style={[styles.cancelBtnText, {color: colors.textSecondary}]}>Not Yet</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: colors.success}]} onPress={() => onConfirm([])}>
                                <Text style={[styles.confirmBtnText, {color: colors.textLight}]}>Complete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.contentLarge, {backgroundColor: colors.surface}]}>
                    {/* Header */}
                    <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
                        <View style={styles.headerLeft}>
                            <Text style={[styles.title, {color: colors.text}]}>Complete Job</Text>
                            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>{jobTitle}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, {backgroundColor: colors.background}]}>
                            <Icon name="x" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Items List */}
                    <View style={styles.itemsList}>
                        <ScrollView 
                            style={[styles.scrollView, {backgroundColor: colors.background}]}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                        >
                            {materialItems.map(item => {
                                const qty = item.quantity || 0;
                                const usedPercent = usageMap[item.id] ?? 100;
                                const usedQty = Math.round((usedPercent / 100) * qty);
                                const isExpanded = expandedItems[item.id];

                                return (
                                    <View key={item.id} style={[styles.itemCard, {backgroundColor: colors.background, borderColor: colors.border}]}>
                                        <TouchableOpacity 
                                            style={[styles.itemHeader, {backgroundColor: colors.surface}]}
                                            onPress={() => toggleItem(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.itemHeaderLeft}>
                                                <Icon 
                                                    name={isExpanded ? "chevron-down" : "chevron-right"} 
                                                    size={14} 
                                                    color={colors.textSecondary} 
                                                />
                                                <Text style={[styles.itemTitle, {color: colors.text}]} numberOfLines={1}>
                                                    {item.description || 'Unnamed'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity 
                                                style={styles.itemHeaderRight}
                                                onPress={() => handleDoubleTap(item.id, qty)}
                                            >
                                                <Text style={[styles.itemPercent, {color: colors.success}]}>{usedPercent}%</Text>
                                                <Text style={[styles.itemUsed, {color: colors.textSecondary}]}>{usedQty}/{qty}</Text>
                                            </TouchableOpacity>
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={[styles.itemSliderWrap, {backgroundColor: colors.background}]}>
                                                <Slider
                                                    style={styles.slider}
                                                    minimumValue={0}
                                                    maximumValue={100}
                                                    step={5}
                                                    value={usedPercent}
                                                    onValueChange={(v) => handleUsageChange(item.id, Math.round(v))}
                                                    minimumTrackTintColor={colors.success}
                                                    maximumTrackTintColor={colors.border}
                                                    thumbTintColor={colors.success}
                                                />
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Fixed Footer */}
                    <View style={[styles.footer, {borderTopColor: colors.border, backgroundColor: colors.surface}]}>
                        <Text style={[styles.totalText, {color: colors.textSecondary}]}>
                            {materialItems.length} items • Used: {summary.totalUsed}
                        </Text>
                        <View style={styles.actions}>
                            <TouchableOpacity style={[styles.cancelBtn, {backgroundColor: colors.surface}, {borderColor: colors.border}]} onPress={onClose}>
                                <Text style={[styles.cancelBtnText, {color: colors.textSecondary}]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: colors.success}]} onPress={handleConfirm}>
                                <Icon name="check" size={16} color={colors.textLight} />
                                <Text style={[styles.confirmBtnText, {color: colors.textLight}]}>Complete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.md,
    },
    content: {

        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.xl,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    contentLarge: {

        borderRadius: theme.borderRadius.lg,
        width: '100%',
        maxWidth: 380,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.md,
        borderBottomWidth: 1,

    },
    headerLeft: {
        flex: 1,
    },
    closeBtn: {
        padding: theme.spacing.xs,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,

        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.md,
    },
    title: {
        fontSize: theme.fontSize.md,
        fontWeight: theme.fontWeight.bold,

    },
    subtitle: {
        fontSize: theme.fontSize.xs,

        marginTop: 2,
    },
    message: {
        fontSize: theme.fontSize.md,

        textAlign: 'center',
        marginBottom: theme.spacing.lg,
        lineHeight: 22,
    },
    itemsList: {
        minHeight: 180,
        maxHeight: 280,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.md,
    },
    itemCard: {
        borderRadius: theme.borderRadius.md,
        marginBottom: theme.spacing.sm,
        minHeight: 44,
        borderWidth: 1,
        overflow: 'hidden',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
    },
    itemHeaderLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    itemHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    itemTitle: {
        flex: 1,
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium,

    },
    itemUsed: {
        fontSize: theme.fontSize.xs,

        fontWeight: theme.fontWeight.semibold,
    },
    itemPercent: {
        fontSize: theme.fontSize.xs,

        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    itemSliderWrap: {
        paddingHorizontal: theme.spacing.sm,
        paddingBottom: theme.spacing.sm,
    },
    slider: {
        width: '100%',
        height: 32,
    },
    footer: {
        borderTopWidth: 1,

        padding: theme.spacing.md,
    },
    totalText: {
        fontSize: theme.fontSize.xs,

        textAlign: 'center',
        marginBottom: theme.spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,

        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium,

    },
    confirmBtn: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,

        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
    confirmBtnText: {
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold,

    },
});

export default JobCompletionModal;
