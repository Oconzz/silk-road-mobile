import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';

export interface CategoryBadgeProps {
    category: string;
    color?: string;
    onPress?: () => void;
    selected?: boolean;
    compact?: boolean;
}

/**
 * CategoryBadge - Display a category as a colored badge/chip
 */
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
    category,
    color: customColor,
    onPress,
    selected = false,
    compact = false,
}) => {
    const color = customColor || getCategoryColor(category);

    const content = (
        <View style={[
            styles.badge,
            { backgroundColor: `${color}20`, borderColor: color },
            selected && styles.badgeSelected,
            compact && styles.badgeCompact,
        ]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[
                styles.text,
                { color },
                compact && styles.textCompact,
            ]}>
                {category}
            </Text>
            {selected && (
                <Icon name="check" size={12} color={color} />
            )}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
};


// Color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
    Roofing: '#EF4444',      // Red
    Flooring: '#8B5CF6',     // Purple
    Electrical: '#F59E0B',   // Amber
    Plumbing: '#3B82F6',     // Blue
    Painting: '#EC4899',     // Pink
    Drywall: '#6B7280',      // Gray
    Framing: '#D97706',      // Orange
    Fixtures: '#14B8A6',     // Teal
    Hardware: '#64748B',     // Slate
    Landscaping: '#22C55E',  // Green
    HVAC: '#0EA5E9',         // Sky
    Insulation: '#A855F7',   // Violet
    Other: '#9CA3AF',        // Gray light
};

export const getCategoryColor = (category: string): string => {
    return CATEGORY_COLORS[category] || '#004732';
};

const styles = StyleSheet.create({
    // Badge
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.full,
        borderWidth: 1,
        gap: 6,
    },
    badgeSelected: {
        borderWidth: 2,
    },
    badgeCompact: {
        paddingVertical: 4,
        paddingHorizontal: theme.spacing.sm,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    text: {
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium,
    },
    textCompact: {
        fontSize: theme.fontSize.xs,
    },
});

export default CategoryBadge;
