import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useEstimate } from '../context/EstimateContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TemplatesListScreenProps } from '../types/navigation';
import type { EstimateTemplateListItem as EstimateTemplateListItemType } from '../services/api/domain/estimateTemplates/estimateTemplateService';

// Use service type for templates list
type EstimateTemplateListItem = EstimateTemplateListItemType;

// Template Card Component - Matches QuickStartCard styling
interface TemplateCardProps {
  template: EstimateTemplateListItem;
  onPress: () => void;
  isUsing?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, onPress, isUsing }) => {
  const { colors } = useTheme();
  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isUsing}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {template.name}
          </Text>
          {template.total > 0 && (
            <Text style={[styles.cardTotal, { color: colors.accent }]}>
              {formatCurrency(template.total)}
            </Text>
          )}
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {template.inventoryCount > 0
            ? `${template.inventoryCount} item${template.inventoryCount > 1 ? 's' : ''}`
            : 'No items'}
        </Text>
      </View>

      {template.description ? (
        <View style={styles.cardContentArea}>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {template.description}
          </Text>
        </View>
      ) : null}

      <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
        <View style={styles.footerLeft}>
          <Icon name="file-text" size={14} color={colors.accent} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Template</Text>
        </View>
        <View style={[styles.useButton, { backgroundColor: colors.accent }]}>
          {isUsing ? (
            <ActivityIndicator size="small" color={colors.textLight} />
          ) : (
            <>
              <Icon name="plus" size={16} color={colors.textLight} />
              <Text style={[styles.useButtonText, { color: colors.textLight }]}>Use</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Empty State Component
const EmptyState: React.FC = () => {
  const { colors } = useTheme();
  return (
  <View style={styles.emptyState}>
    <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
      <Icon name="folder" size={48} color={colors.textSecondary} />
    </View>
    <Text style={[styles.emptyTitle, {color: colors.text}]}>No Templates Yet</Text>
    <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
      Save an estimate as a template to reuse it for future projects
    </Text>
  </View>
  );
};

export const TemplatesListScreen: React.FC<TemplatesListScreenProps> = ({ navigation }) => {
  const { templates, loadTemplates, initDraft, isLoading, getTemplate } = useEstimate();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [usingTemplateId, setUsingTemplateId] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates by search
  const filteredTemplates = templates.filter(template => {
    if (!searchQuery) { return true; }
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query)
    );
  });

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTemplates();
    } finally {
      setRefreshing(false);
    }
  }, [loadTemplates]);

  // Handle template press - load full template, create draft, navigate (like Quick Start)
  const handleUseTemplate = useCallback(async (template: EstimateTemplateListItem) => {
    if (usingTemplateId) return;
    setUsingTemplateId(template.id);
    try {
      const fullTemplate = await getTemplate(template.id);
      if (fullTemplate) {
        // Map template to EstimateRM-like shape for initDraft
        const asEstimate = {
          name: fullTemplate.name,
          description: fullTemplate.description || '',
          items: (fullTemplate.items || []).map(item => ({
            id: item.id || `item-${Date.now()}-${Math.random()}`,
            title: item.title || item.description,
            description: item.description,
            quantity: item.quantity,
            price: item.cost,
            cost: item.cost,
            labor: item.labor || 0,
            barcode: item.barcode || '',
            source: item.source || '',
            productId: item.productId,
            warehouseId: item.warehouseId,
            inventoryId: item.inventoryId,
          })),
        } as any;
        initDraft(asEstimate);
      } else {
        initDraft();
      }
      navigation.navigate('CreateEstimate');
    } catch (err) {
      console.error('[Templates] Error using template:', err);
    } finally {
      setUsingTemplateId(null);
    }
  }, [usingTemplateId, getTemplate, initDraft, navigation]);

  // Render template card
  const renderTemplate = useCallback(({ item }: { item: EstimateTemplateListItem }) => (
    <TemplateCard
      template={item}
      onPress={() => handleUseTemplate(item)}
      isUsing={usingTemplateId === item.id}
    />
  ), [handleUseTemplate, usingTemplateId]);

  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Collapsible header animation
  const [headerHeight, setHeaderHeight] = useState(0);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderHidden = useRef(false);

  const onHeaderLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && height !== headerHeight) {
      setHeaderHeight(height);
    }
  }, [headerHeight]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (headerHeight === 0) return;
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const diff = currentScrollY - lastScrollY.current;
      if (diff > 5 && currentScrollY > 50 && !isHeaderHidden.current) {
        isHeaderHidden.current = true;
        Animated.spring(headerTranslateY, { toValue: -headerHeight, useNativeDriver: true, tension: 80, friction: 12 }).start();
      } else if (diff < -5 && isHeaderHidden.current) {
        isHeaderHidden.current = false;
        Animated.spring(headerTranslateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
      lastScrollY.current = currentScrollY;
    },
    [headerHeight, headerTranslateY]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Collapsible Header */}
      <Animated.View
        style={[styles.collapsibleHeader, { backgroundColor: colors.surface, paddingTop: insets.top, transform: [{ translateY: headerTranslateY }] }]}
        onLayout={onHeaderLayout}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.headerAccentBar, { backgroundColor: colors.accent }]} />
              <View>
                <View style={styles.headerLabelRow}>
                  <Icon name="layout" size={14} color={colors.accent} />
                  <Text style={[styles.headerLabel, { color: colors.accent }]}>TEMPLATES</Text>
                </View>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                  {templates.length} {templates.length === 1 ? 'template' : 'templates'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                initDraft();
                navigation.navigate('CreateEstimate');
              }}
            >
              <Icon name="plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Icon name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search templates..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Templates List */}
      <Animated.FlatList
        data={filteredTemplates}
        renderItem={renderTemplate}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            progressViewOffset={headerHeight}
          />
        }
        ListEmptyComponent={!isLoading ? <EmptyState /> : null}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },

  collapsibleHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  headerCard: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerAccentBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  headerLabel: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: 1,
  },
  headerCount: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    paddingVertical: Platform.OS === 'ios' ? theme.spacing.sm : theme.spacing.xs,
  },

  // List
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 120,
  },

  // Card - matches QuickStartCard styling
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
  cardTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  cardSubtitle: {
    fontSize: theme.fontSize.sm,
  },
  cardContentArea: {
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
    minWidth: 70,
    justifyContent: 'center',
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
