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
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useJob } from '../context/JobContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions, PermissionKeys } from '../context/PermissionContext';
import { AnimatedPressable } from '../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { JobListItem, JobStatus } from '../types/job';
import { getJobStatusColor, getJobStatusLabel } from '../types/job';
import { useFreemiumLimits } from '../hooks/useFreemiumLimits';

const JOB_DRAFT_KEY = '@nmj_job_draft';

// Filter options
type FilterStatus = 'all' | 'scheduled' | 'in_progress' | 'completed';

// Job Card Component
interface JobCardProps {
  job: JobListItem;
  onPress: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onPress }) => {
  const {colors} = useTheme();
  const statusColor = getJobStatusColor(job.status);
  const statusLabel = getJobStatusLabel(job.status);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount?: number) => {
    const value = amount ?? 0;
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <AnimatedPressable style={[styles.jobCard, {backgroundColor: colors.surface}]} onPress={onPress}>
      {/* Header with Status */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={1}>
            {job.title || 'Untitled Job'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text style={[styles.cardSubtitle, {color: colors.textSecondary}]}>
          {job.clientId ? (job.clientName || 'Client') : 'No client assigned'}
        </Text>
      </View>

      {/* Info Row */}
      <View style={styles.cardContent}>
        <View style={styles.cardDetail}>
          <Icon name="map-pin" size={14} color={colors.textSecondary} />
          <Text style={[styles.cardDetailText, {color: colors.textSecondary}]}>
            {job.locationCity || 'No location'}
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Icon name="calendar" size={14} color={colors.textSecondary} />
          <Text style={[styles.cardDetailText, {color: colors.textSecondary}]}>
            {formatDate(job.scheduledStartDate)}
          </Text>
        </View>
        {job.isRecurring && (
          <View style={[styles.cardDetail, {backgroundColor: `${colors.accent}12`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}]}>
            <Icon name="repeat" size={12} color={colors.accent} />
            <Text style={[styles.cardDetailText, {color: colors.accent, fontWeight: '600', fontSize: 11}]}>
              Recurring{(job.childJobsCount ?? 0) > 0 ? ` · ${job.childJobsCount} jobs` : ''}
            </Text>
          </View>
        )}
        {job.parentJobId && !job.isRecurring && (
          <View style={[styles.cardDetail, {backgroundColor: `${colors.warning}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}]}>
            <Icon name="git-branch" size={12} color={colors.warning} />
            <Text style={[styles.cardDetailText, {color: colors.warning, fontWeight: '600', fontSize: 11}]}>
              Auto-scheduled
            </Text>
          </View>
        )}
      </View>

      {/* Footer with Total */}
      <View style={[styles.cardFooter, {backgroundColor: colors.surface}, {borderTopColor: colors.divider}]}>
        <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Estimated Total</Text>
        <Text style={[styles.totalValue, {color: colors.accent}]}>{formatCurrency(job.estimatedTotal)}</Text>
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
  count?: number;
}

const FilterButton: React.FC<FilterButtonProps> = ({ status, label, currentFilter, onPress, count }) => {
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
      {count !== undefined && count > 0 && (
        <View style={[
          styles.filterCount, 
          {backgroundColor: colors.border}, 
          isActive && {backgroundColor: 'rgba(255,255,255,0.2)'}
        ]}>
          <Text style={[
            styles.filterCountText, 
            {color: colors.textSecondary}, 
            isActive && {color: colors.textLight}
          ]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Empty State Component
const EmptyState: React.FC<{ filter: FilterStatus }> = ({ filter }) => {
  const {colors} = useTheme();
  const getMessage = () => {
    switch (filter) {
      case 'scheduled':
        return 'No scheduled jobs. Convert an approved estimate to create a job.';
      case 'in_progress':
        return 'No jobs in progress. Start a scheduled job to begin work.';
      case 'completed':
        return 'No completed jobs yet. Complete your first job to see it here.';
      default:
        return 'No jobs yet. Jobs are created when estimates are approved.';
    }
  };

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
        <Icon name="briefcase" size={48} color={colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, {color: colors.text}]}>
        {filter === 'all' ? 'No Jobs Yet' : `No ${getJobStatusLabel(filter === 'in_progress' ? 'in_progress' : filter as JobStatus)} Jobs`}
      </Text>
      <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>{getMessage()}</Text>
    </View>
  );
};

export const JobsListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentCompany } = useAuth();
  const { hasPermission } = usePermissions();

  const { jobs, loading, loadJobs } = useJob();
  const { enforceLimit } = useFreemiumLimits();

  // Check permissions for job management
  const role = currentCompany?.role?.toLowerCase() || '';
  const isAdminOrLeader = role === 'admin' || role === 'superadmin' || role === 'leader';
  const canCreateJobs = isAdminOrLeader || hasPermission(PermissionKeys.CreateJobs);
  const canViewAllJobs = isAdminOrLeader || hasPermission(PermissionKeys.ViewAllJobs);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'status'>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [localDraft, setLocalDraft] = useState<JobListItem | null>(null);

  // Load local draft from AsyncStorage
  const loadLocalDraft = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(JOB_DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        // Only show draft if it has a title
        if (draft.title?.trim()) {
          const draftItem: JobListItem = {
            id: 'local-draft',
            companyId: '',
            jobNumber: '',
            title: draft.title || 'Untitled Draft',
            status: 'draft' as JobStatus,
            clientId: draft.clientId,
            clientName: draft.client?.contactName,
            locationCity: draft.location?.city,
            scheduledStartDate: draft.startDate,
            estimatedTotal: 0,
            createDatetime: new Date().toISOString(),
          };
          setLocalDraft(draftItem);
        } else {
          setLocalDraft(null);
        }
      } else {
        setLocalDraft(null);
      }
    } catch (err) {
      console.error('[JobsListScreen] Error loading local draft:', err);
      setLocalDraft(null);
    }
  }, []);

  // Reload jobs when screen receives focus
  useFocusEffect(
    useCallback(() => {
      console.log('[JobsListScreen] Screen focused, reloading jobs');
      const reload = async () => {
        // Silent reload on focus
        await loadJobs(true);
        await loadLocalDraft();
      };
      reload();
    }, [loadJobs, loadLocalDraft])
  );

  // Compute filtered jobs by status
  const scheduledJobs = jobs?.filter(job => job.status === 'scheduled') || [];
  const activeJobs = jobs?.filter(job => job.status === 'in_progress' || job.status === 'on_hold') || [];
  const completedJobs = jobs?.filter(job => job.status === 'completed') || [];

  // Filter jobs and include local draft at the top
  const baseFilteredJobs = (jobs || []).filter(job => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.jobNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.clientName?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (filterStatus === 'scheduled') {
      matchesStatus = job.status === 'scheduled';
    } else if (filterStatus === 'in_progress') {
      matchesStatus = job.status === 'in_progress' || job.status === 'on_hold';
    } else if (filterStatus === 'completed') {
      matchesStatus = job.status === 'completed';
    }

    return matchesSearch && matchesStatus;
  });

  // Sort jobs
  const sortedJobs = [...baseFilteredJobs].sort((a, b) => {
    if (sortBy === 'name') {
      return (a.title || '').localeCompare(b.title || '');
    } else if (sortBy === 'status') {
      const statusOrder: Record<string, number> = { draft: 0, scheduled: 1, in_progress: 2, on_hold: 3, completed: 4, cancelled: 5 };
      return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    }
    // Default: recent (by createDatetime descending)
    return new Date(b.createDatetime || 0).getTime() - new Date(a.createDatetime || 0).getTime();
  });

  // Include local draft at the top when viewing "all" filter
  const filteredJobs = filterStatus === 'all' && localDraft
    ? [localDraft, ...sortedJobs]
    : sortedJobs;

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadJobs(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadJobs]);

  // Open job
  const handleOpenJob = useCallback((job: JobListItem) => {
    // If it's the local draft, navigate to CreateJob to continue editing
    if (job.id === 'local-draft') {
      navigation.navigate('CreateJob');
    } else {
      navigation.navigate('JobDetail', { jobId: job.id });
    }
  }, [navigation]);

  // Render job card
  const renderJob = useCallback(({ item }: { item: JobListItem }) => (
    <JobCard
      job={item}
      onPress={() => handleOpenJob(item)}
    />
  ), [handleOpenJob]);

  // Create new job
  const handleCreateJob = useCallback(() => {
    if (!enforceLimit('jobs', jobs.length)) return;
    navigation.navigate('CreateJob', { isNewJob: true });
  }, [navigation, enforceLimit, jobs.length]);

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
                  <Icon name="briefcase" size={14} color={colors.accent} />
                  <Text style={[styles.headerLabel, { color: colors.accent }]}>
                    {canViewAllJobs ? 'JOBS' : 'MY JOBS'}
                  </Text>
                </View>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                  {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                </Text>
              </View>
            </View>
            {canCreateJobs && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.accent }]}
                onPress={handleCreateJob}
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
              placeholder="Search jobs..."
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
            <FilterButton 
              status="all" 
              label={canViewAllJobs ? "All" : "Assigned"} 
              currentFilter={filterStatus} 
              onPress={setFilterStatus}
              count={jobs.length}
            />
            <FilterButton
              status="scheduled"
              label="Scheduled"
              currentFilter={filterStatus}
              onPress={setFilterStatus}
              count={scheduledJobs.length}
            />
            <FilterButton
              status="in_progress"
              label="Active"
              currentFilter={filterStatus}
              onPress={setFilterStatus}
              count={activeJobs.length}
            />
            <FilterButton
              status="completed"
              label="Done"
              currentFilter={filterStatus}
              onPress={setFilterStatus}
              count={completedJobs.length}
            />
          </ScrollView>

          {/* Sort Options */}
          <View style={[styles.sortContainer, { borderTopColor: colors.divider }]}>
            <Icon name="sliders" size={14} color={colors.textSecondary} />
            {(['recent', 'name', 'status'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.sortOption, sortBy === option && styles.sortOptionActive && { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}
                onPress={() => setSortBy(option)}>
                <Text style={[styles.sortOptionText, { color: colors.textSecondary }, sortBy === option && { color: colors.accent, fontWeight: theme.fontWeight.semibold }]}>
                  {option === 'recent' ? 'Recent' : option === 'name' ? 'Name' : 'Status'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Jobs List */}
      <Animated.FlatList
        data={filteredJobs as any}
        renderItem={renderJob}
        keyExtractor={(item: any) => item.id}
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
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <EmptyState filter={filterStatus} />
          )
        }
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    gap: 6,
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
  filterCount: {
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
  },
  filterCountTextActive: {
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
  sortLabel: {
    fontSize: theme.fontSize.sm,
  },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortOptionActive: {
    borderWidth: 1,
  },
  sortOptionText: {
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.2,
  },
  sortOptionTextActive: {
    fontWeight: theme.fontWeight.semibold,
  },

  // List
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },

  // Job Card
  jobCard: {
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
    marginBottom: theme.spacing.xs,
  },
  jobNumberBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  jobNumberText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 2,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  cardSubtitle: {
    fontSize: theme.fontSize.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    maxWidth: 280,
  },
});

export default JobsListScreen;
