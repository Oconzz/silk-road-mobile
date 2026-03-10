import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useEstimate } from '../context/EstimateContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions, PermissionKeys } from '../context/PermissionContext';
import { AnimatedPressable } from '../components/ui';
import { useFreemiumLimits } from '../hooks/useFreemiumLimits';
import { QuickStartList } from '../components/QuickStartList';
import { quickStartTemplateService } from '../services/api/domain/quickStartTemplates/quickStartTemplateService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { EstimateListItem } from '../types/estimate';
import type { QuickStartTemplate } from '../types/quickStartTemplate';

// Filter options
type FilterStatus = 'quickstart' | 'all' | 'draft' | 'sent' | 'approved';

// Estimate Card Component
interface EstimateCardProps {
  estimate: EstimateListItem;
  onPress: () => void;
}

const EstimateCard: React.FC<EstimateCardProps> = ({ estimate, onPress }) => {
  const {colors} = useTheme();
  const getStatusColor = () => {
    if (estimate.approved) { return colors.success; }
    if (estimate.sent) { return colors.warning; }
    return colors.textSecondary;
  };

  const getStatusText = () => {
    if (estimate.approved) { return 'Approved'; }
    if (estimate.sent) { return 'Sent'; }
    return 'Draft';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <AnimatedPressable style={[styles.estimateCard, {backgroundColor: colors.surface}]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={1}>
            {estimate.name || 'Untitled Estimate'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
            <Icon
              name={estimate.approved ? 'check-circle' : estimate.sent ? 'send' : 'edit-3'}
              size={11}
              color={getStatusColor()}
            />
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
        <Text style={[styles.cardSubtitle, {color: colors.textSecondary}]}>
          {estimate.clientName || 'No client assigned'}
        </Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardDetail}>
          <Icon name="map-pin" size={14} color={colors.textSecondary} />
          <Text style={[styles.cardDetailText, {color: colors.textSecondary}]}>
            {estimate.locationCity || 'No location'}
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Icon name="calendar" size={14} color={colors.textSecondary} />
          <Text style={[styles.cardDetailText, {color: colors.textSecondary}]}>
            {formatDate(estimate.createDatetime)}
          </Text>
        </View>
      </View>

      <View style={[styles.cardFooter, {backgroundColor: colors.surface}, {borderTopColor: colors.divider}]}>
        <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Total</Text>
        <Text style={[styles.totalValue, {color: colors.accent}]}>{formatCurrency(estimate.total)}</Text>
      </View>
    </AnimatedPressable>
  );
};

// Filter Button Component
interface FilterButtonProps {
  status: FilterStatus;
  label: string;
  currentFilter: FilterStatus;
  onPress: (status: FilterStatus) => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({ status, label, currentFilter, onPress }) => {
  const {colors} = useTheme();
  const isActive = currentFilter === status;
  return (
    <TouchableOpacity
      style={[
        styles.filterButton, 
        {backgroundColor: colors.surface, borderColor: colors.border}, 
        isActive && {backgroundColor: colors.accent, borderColor: colors.accent}
      ]}
      onPress={() => onPress(status)}>
      <Text style={[
        styles.filterButtonText, 
        {color: colors.textSecondary}, 
        isActive && {color: colors.textLight}
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// Empty State Component
const EmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => {
  const {colors} = useTheme();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
        <Icon name="file-text" size={48} color={colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, {color: colors.text}]}>No Estimates Yet</Text>
      <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
        Create your first estimate to get started with your projects
      </Text>
      <TouchableOpacity style={[styles.emptyButton, {backgroundColor: colors.accent}]} onPress={onCreateNew}>
        <Icon name="plus" size={18} color={colors.textLight} />
        <Text style={[styles.emptyButtonText, {color: colors.textLight}]}>Create Estimate</Text>
      </TouchableOpacity>
    </View>
  );
};

export const EstimatesListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { estimates, isLoading, loadEstimates, initDraft } = useEstimate();
  const { enforceLimit } = useFreemiumLimits();
  const { currentCompany } = useAuth();
  const { hasPermission } = usePermissions();

  // Check permissions
  const role = currentCompany?.role?.toLowerCase() || '';
  const isAdminOrLeader = role === 'admin' || role === 'superadmin' || role === 'leader';
  const canCreateEstimates = isAdminOrLeader || hasPermission(PermissionKeys.CreateEstimates);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('quickstart');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'total'>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [quickStartTemplates, setQuickStartTemplates] = useState<QuickStartTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Load Quick Start templates based on company category
  // Using useFocusEffect to reload templates when screen gains focus (fixes template loading after sign in)
  useFocusEffect(
    useCallback(() => {
      const loadTemplates = async () => {
        const category = (currentCompany as any)?.category;
        if (!category) return;

        setTemplatesLoading(true);
        try {
          const templates = await quickStartTemplateService.getTemplatesByCategory(category);
          setQuickStartTemplates(templates);
        } catch {
          // Silent fail for template loading
        } finally {
          setTemplatesLoading(false);
        }
      };

      loadTemplates();
    }, [currentCompany])
  );

  // Reload estimates when screen receives focus
  useFocusEffect(
    useCallback(() => {
      const reload = async () => {
        // Silent reload on focus
        await loadEstimates();
      };
      reload();
    }, [loadEstimates])
  );

  // Filter estimates
  const filteredEstimates = estimates.filter(estimate => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      estimate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      estimate.clientName?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (filterStatus === 'draft') {
      matchesStatus = !estimate.sent && !estimate.approved;
    } else if (filterStatus === 'sent') {
      matchesStatus = estimate.sent && !estimate.approved;
    } else if (filterStatus === 'approved') {
      matchesStatus = estimate.approved;
    }

    return matchesSearch && matchesStatus;
  });

  // Sort estimates
  const sortedEstimates = [...filteredEstimates].sort((a, b) => {
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (sortBy === 'total') {
      return (b.total || 0) - (a.total || 0);
    }
    // Default: recent (by createDatetime descending)
    return new Date(b.createDatetime || 0).getTime() - new Date(a.createDatetime || 0).getTime();
  });

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEstimates();
    } finally {
      setRefreshing(false);
    }
  }, [loadEstimates]);

  // Create new estimate
  const handleCreateNew = useCallback(() => {
    if (!enforceLimit('estimates', estimates.length)) return;
    initDraft();
    navigation.navigate('CreateEstimate');
  }, [navigation, initDraft, enforceLimit, estimates.length]);

  // Open estimate
  const handleOpenEstimate = useCallback((estimate: EstimateListItem) => {
    navigation.navigate('EstimateDetail', { estimateId: estimate.id });
  }, [navigation]);

  // Handle Quick Start template selection
  const handleQuickStartSelect = useCallback(async (template: QuickStartTemplate) => {
    try {
      const draft = await quickStartTemplateService.copyTemplateToDraft(template.id);
      if (draft?.id) {
        navigation.navigate('EstimateDetail', { estimateId: draft.id });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create estimate from template');
    }
  }, [navigation]);


  // Render estimate card
  const renderEstimate = useCallback(({ item }: { item: EstimateListItem }) => (
    <EstimateCard
      estimate={item}
      onPress={() => handleOpenEstimate(item)}
    />
  ), [handleOpenEstimate]);

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

      // Scrolling down - hide header
      if (diff > 5 && currentScrollY > 50 && !isHeaderHidden.current) {
        isHeaderHidden.current = true;
        Animated.spring(headerTranslateY, {
          toValue: -headerHeight,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      }
      // Scrolling up - show header
      else if (diff < -5 && isHeaderHidden.current) {
        isHeaderHidden.current = false;
        Animated.spring(headerTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      }

      lastScrollY.current = currentScrollY;
    },
    [headerHeight, headerTranslateY]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Collapsible Header Section */}
      <Animated.View
        style={[
          styles.collapsibleHeader,
          { backgroundColor: colors.surface, paddingTop: insets.top, transform: [{ translateY: headerTranslateY }] },
        ]}
        onLayout={onHeaderLayout}
      >
        {/* Header Card */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
          {/* Title Row */}
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.headerAccentBar, { backgroundColor: colors.accent }]} />
              <View>
                <View style={styles.headerLabelRow}>
                  <Icon name="file-text" size={14} color={colors.accent} />
                  <Text style={[styles.headerLabel, { color: colors.accent }]}>ESTIMATES</Text>
                </View>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                  {estimates.length} {estimates.length === 1 ? 'estimate' : 'estimates'}
                </Text>
              </View>
            </View>
            {canCreateEstimates && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.accent }]}
                onPress={handleCreateNew}
                activeOpacity={0.8}>
                <Icon name="plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Icon name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search estimates..."
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

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
            <FilterButton status="quickstart" label="Quick Start" currentFilter={filterStatus} onPress={setFilterStatus} />
            <FilterButton status="all" label="All" currentFilter={filterStatus} onPress={setFilterStatus} />
            <FilterButton status="draft" label="Draft" currentFilter={filterStatus} onPress={setFilterStatus} />
            <FilterButton status="sent" label="Sent" currentFilter={filterStatus} onPress={setFilterStatus} />
            <FilterButton status="approved" label="Approved" currentFilter={filterStatus} onPress={setFilterStatus} />
          </ScrollView>

          {/* Sort Options - Hide for Quick Start tab */}
          {filterStatus !== 'quickstart' && (
            <View style={[styles.sortContainer, { borderTopColor: colors.divider }]}>
              <Icon name="sliders" size={14} color={colors.textSecondary} />
              {(['recent', 'name', 'total'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.sortOption, sortBy === option && { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}
                  onPress={() => setSortBy(option)}>
                  <Text style={[styles.sortOptionText, { color: colors.textSecondary }, sortBy === option && { color: colors.accent, fontWeight: theme.fontWeight.semibold }]}>
                    {option === 'recent' ? 'Recent' : option === 'name' ? 'Name' : 'Total'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Animated.View>

      {/* Quick Start Templates - Show only when Quick Start tab is selected */}
      {filterStatus === 'quickstart' ? (
        <QuickStartList
          templates={quickStartTemplates}
          onSelect={handleQuickStartSelect}
          isLoading={templatesLoading}
          onScroll={onScroll}
          headerHeight={Math.max(0, headerHeight - insets.top + 8)}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        /* Estimates List - Show for other tabs */
        <Animated.FlatList
          data={sortedEstimates}
          renderItem={renderEstimate}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingTop: Math.max(0, headerHeight - insets.top + 8) }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              progressViewOffset={headerHeight}
            />
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={[styles.emptyState, {backgroundColor: colors.background}]}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : (
              <EmptyState onCreateNew={handleCreateNew} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },

  // Collapsible Header
  collapsibleHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  // Header Card
  headerCard: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
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
    gap: 6,
  },
  headerLabel: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: 1.2,
  },
  headerCount: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    marginTop: 2,
  },

  // Add Button
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#004732',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.md,
  },

  // Filters
  filterContainer: {
    flexDirection: 'row',
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
  },
  filterButtonActive: {
  },
  filterButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.2,
  },
  filterButtonTextActive: {
  },

  // Sort
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.sm,
  },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortOptionText: {
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.2,
  },

  // List
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100, // Space for tab bar
  },

  // Estimate Card
  estimateCard: {
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  cardContent: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDetailText: {
    fontSize: theme.fontSize.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: theme.spacing.sm,
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,
  },
  totalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
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
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  emptyButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    right: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.lg,
  },
});
