import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    RefreshControl,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import type { QuickStartTemplate } from '../types/quickStartTemplate';

interface QuickStartListProps {
    templates: QuickStartTemplate[];
    onSelect: (template: QuickStartTemplate) => void;
    isLoading?: boolean;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    headerHeight?: number;
    refreshing?: boolean;
    onRefresh?: () => void;
}

// QuickStart Card Component - Matches EstimateCard styling
const QuickStartCard: React.FC<{
    template: QuickStartTemplate;
    onPress: () => void;
}> = ({ template, onPress }) => {
    const {colors} = useTheme();
    return (
        <TouchableOpacity style={[styles.card, {backgroundColor: colors.surface}]} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                    <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={1}>
                        {template.name}
                    </Text>
                    <View style={[styles.templateBadge, {backgroundColor: `${colors.accent}20`}]}>
                        <Text style={[styles.templateBadgeText, {color: colors.accent}]}>Template</Text>
                    </View>
                </View>
                <Text style={[styles.cardSubtitle, {color: colors.textSecondary}]} numberOfLines={1}>
                    {template.category}
                </Text>
            </View>

            <View style={styles.cardContent}>
                <Text style={[styles.cardDescription, {color: colors.textSecondary}]} numberOfLines={2}>
                    {template.description}
                </Text>
            </View>

            <View style={[styles.cardFooter, {backgroundColor: colors.surface}, {borderTopColor: colors.divider}]}>
                <View style={styles.footerLeft}>
                    <Icon name="zap" size={14} color={colors.accent} />
                    <Text style={[styles.footerText, {color: colors.textSecondary}]}>Quick Start</Text>
                </View>
                <View style={[styles.useButton, {backgroundColor: colors.accent}]}>
                    <Icon name="plus" size={16} color={colors.textLight} />
                    <Text style={[styles.useButtonText, {color: colors.textLight}]}>Use</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

export const QuickStartList: React.FC<QuickStartListProps> = ({
    templates,
    onSelect,
    isLoading = false,
    onScroll,
    headerHeight = 0,
    refreshing = false,
    onRefresh,
}) => {
    const {colors} = useTheme();
    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    if (templates.length === 0) {
        return (
            <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
                    <Icon name="zap" size={48} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, {color: colors.text}]}>No Templates Available</Text>
                <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
                    Templates for your industry will appear here
                </Text>
            </View>
        );
    }

    const renderCard = ({ item }: { item: QuickStartTemplate }) => (
        <QuickStartCard template={item} onPress={() => onSelect(item)} />
    );

    return (
        <Animated.FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            contentContainerStyle={[styles.listContent, { paddingTop: headerHeight }]}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            refreshControl={
                onRefresh ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.accent}
                        progressViewOffset={headerHeight}
                    />
                ) : undefined
            }
        />
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.xxl,
    },
    listContent: {
        padding: theme.spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },

    // Card - matches EstimateCard styling
    card: {

        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        ...theme.shadow.sm,
    },
    cardHeader: {
        marginBottom: theme.spacing.sm,
    },
    cardTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold,

        flex: 1,
        marginRight: theme.spacing.sm,
    },
    cardSubtitle: {
        fontSize: theme.fontSize.sm,

    },
    templateBadge: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.full,

    },
    templateBadgeText: {
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold,

    },
    cardContent: {
        marginBottom: theme.spacing.sm,
    },
    cardDescription: {
        fontSize: theme.fontSize.sm,

        lineHeight: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,

        paddingTop: theme.spacing.sm,
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerText: {
        fontSize: theme.fontSize.sm,

    },
    useButton: {
        flexDirection: 'row',
        alignItems: 'center',

        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.md,
        gap: 4,
    },
    useButtonText: {
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold,

    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.lg,
    },
    emptyIconWrap: {
        width: 96,
        height: 96,
        borderRadius: 48,

        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.lg,
        ...theme.shadow.sm,
    },
    emptyTitle: {
        fontSize: theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold,

        marginBottom: theme.spacing.sm,
    },
    emptySubtitle: {
        fontSize: theme.fontSize.md,

        textAlign: 'center',
    },
});
