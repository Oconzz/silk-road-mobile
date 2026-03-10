import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useClient } from '../context/ClientContext';
import { useEstimate } from '../context/EstimateContext';
import { useJob } from '../context/JobContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions, PermissionKeys } from '../context/PermissionContext';
import { AnimatedPressable } from '../components/ui';
import { useFreemiumLimits } from '../hooks/useFreemiumLimits';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import type { ClientListItem } from '../types/apiResponses';

// Client Card Component
interface ClientCardProps {
  client: ClientListItem;
  jobCount: number;
  estimateCount: number;
  onPress: () => void;
  onCreateJob: () => void;
  onCreateEstimate: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({
  client,
  jobCount,
  estimateCount,
  onPress,
  onCreateJob,
  onCreateEstimate,
}) => {
  const { colors } = useTheme();
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <AnimatedPressable style={[styles.clientCard, {backgroundColor: colors.surface}]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatarWrap, {backgroundColor: colors.accent}]}>
          <Text style={[styles.avatarText, {color: colors.textLight}]}>
            {client.contactName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.clientMainContent}>
          <View style={styles.clientTopRow}>
            <Text style={[styles.clientName, {color: colors.text}]} numberOfLines={1}>
              {client.contactName}
            </Text>
            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionBtn, {backgroundColor: colors.background, borderColor: colors.border}]}
                onPress={(e) => {
                  e.stopPropagation();
                  onCreateJob();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="tool" size={16} color={colors.warning} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionBtn, {backgroundColor: colors.background, borderColor: colors.border}]}
                onPress={(e) => {
                  e.stopPropagation();
                  onCreateEstimate();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="file-text" size={16} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>
          {client.primaryAddress && (
            <View style={styles.contactRow}>
              <Icon name="map-pin" size={13} color={colors.textSecondary} />
              <Text style={[styles.contactText, {color: colors.textSecondary}]}>{client.primaryAddress}</Text>
            </View>
          )}
          <View style={styles.contactRow}>
            <Icon name="phone" size={13} color={colors.textSecondary} />
            <Text style={[styles.contactText, {color: colors.textSecondary}]}>{client.phone}</Text>
          </View>
          <View style={styles.contactRow}>
            <Icon name="mail" size={13} color={colors.textSecondary} />
            <Text style={[styles.contactText, {color: colors.textSecondary}]}>{client.email}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.cardFooter, {backgroundColor: colors.surface}, {borderTopColor: colors.divider}]}>
        <View style={styles.statItem}>
          <Icon name="briefcase" size={14} color={colors.textSecondary} />
          <Text style={[styles.statText, {color: colors.textSecondary}]}>{jobCount} jobs</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="file-text" size={14} color={colors.textSecondary} />
          <Text style={[styles.statText, {color: colors.textSecondary}]}>{estimateCount} estimates</Text>
        </View>
        <Text style={[styles.dateText, {color: colors.textSecondary}]}>Since {formatDate(client.createDatetime)}</Text>
      </View>
    </AnimatedPressable>
  );
};

// Empty State Component
const EmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => {
  const { colors } = useTheme();
  return (
  <View style={styles.emptyState}>
    <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
      <Icon name="users" size={48} color={colors.textSecondary} />
    </View>
    <Text style={[styles.emptyTitle, {color: colors.text}]}>No Clients Yet</Text>
    <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
      Add your first client to start creating estimates and jobs
    </Text>
    <TouchableOpacity style={[styles.emptyButton, {backgroundColor: colors.accent}]} onPress={onCreateNew}>
      <Icon name="user-plus" size={18} color={colors.textLight} />
      <Text style={[styles.emptyButtonText, {color: colors.textLight}]}>Add Client</Text>
    </TouchableOpacity>
  </View>
  );
};

// Sort options
type SortOption = 'name' | 'recent' | 'jobs';

export const ClientsListScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClientsList'>>();
  // Get import success message from navigation params
  const importSuccessMessage = route.params?.importSuccessMessage;

  const { clients, loadClients } = useClient();
  const { enforceLimit } = useFreemiumLimits();
  const { estimates } = useEstimate();
  const { jobs } = useJob();
  const { currentCompany } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Check permissions
  const role = currentCompany?.role?.toLowerCase() || '';
  const isAdminOrLeader = role === 'admin' || role === 'superadmin' || role === 'leader';
  const canManageClients = isAdminOrLeader || hasPermission(PermissionKeys.ManageClients);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(!!importSuccessMessage);

  // Auto-dismiss success banner after 4 seconds
  useEffect(() => {
    if (importSuccessMessage) {
      setShowSuccessBanner(true);
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [importSuccessMessage]);

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Calculate job and estimate counts per client
  const clientStats = useMemo(() => {
    const stats: Record<string, { jobs: number; estimates: number }> = {};

    clients.forEach(client => {
      const clientJobs = jobs.filter(j => j.clientId === client.id);
      const clientEstimates = estimates.filter(e => e.clientName === client.contactName);
      stats[client.id] = {
        jobs: clientJobs.length,
        estimates: clientEstimates.length,
      };
    });

    return stats;
  }, [clients, jobs, estimates]);

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search filter
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(client =>
        client.contactName.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        client.phone.includes(term) ||
        client.companyName?.toLowerCase().includes(term)
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.contactName.localeCompare(b.contactName));
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.createDatetime).getTime() - new Date(a.createDatetime).getTime());
        break;
      case 'jobs':
        result.sort((a, b) => (clientStats[b.id]?.jobs || 0) - (clientStats[a.id]?.jobs || 0));
        break;
    }

    return result;
  }, [clients, searchQuery, sortBy, clientStats]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadClients();
    } finally {
      setRefreshing(false);
    }
  }, [loadClients]);

  // Create new client
  const handleCreateNew = useCallback(() => {
    if (!enforceLimit('clients', clients.length)) return;
    navigation.navigate('CreateClient');
  }, [navigation, enforceLimit, clients.length]);

  // Import contacts
  const handleImportContacts = useCallback(() => {
    navigation.navigate('ContactImport');
  }, [navigation]);

  // Open client profile
  const handleOpenClient = useCallback((client: ClientListItem) => {
    navigation.navigate('ClientProfile', { clientId: client.id });
  }, [navigation]);

  // Create job for client
  const handleCreateJobForClient = useCallback((clientId: string) => {
    navigation.navigate('CreateJob', { clientId });
  }, [navigation]);

  // Create estimate for client
  const handleCreateEstimateForClient = useCallback((_client: ClientListItem) => {
    // Navigate to CreateEstimate with pre-selected client
    navigation.navigate('CreateEstimate');
    // Note: Client will need to be selected in the screen
    // TODO: Pass client as param when CreateEstimate supports it
  }, [navigation]);


  // Render client card
  const renderClient = useCallback(({ item }: { item: ClientListItem }) => (
    <ClientCard
      client={item}
      jobCount={clientStats[item.id]?.jobs || 0}
      estimateCount={clientStats[item.id]?.estimates || 0}
      onPress={() => handleOpenClient(item)}
      onCreateJob={() => handleCreateJobForClient(item.id)}
      onCreateEstimate={() => handleCreateEstimateForClient(item)}
    />
  ), [clientStats, handleOpenClient, handleCreateJobForClient, handleCreateEstimateForClient]);

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
                  <Icon name="users" size={14} color={colors.accent} />
                  <Text style={[styles.headerLabel, { color: colors.accent }]}>CLIENTS</Text>
                </View>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                  {clients.length} {clients.length === 1 ? 'client' : 'clients'}
                </Text>
              </View>
            </View>
            {canManageClients && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={[styles.importButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handleImportContacts}
                  activeOpacity={0.8}>
                  <Icon name="download" size={16} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: colors.accent }]}
                  onPress={handleCreateNew}
                  activeOpacity={0.8}>
                  <Icon name="plus" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Icon name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search clients..."
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

          {/* Success Banner */}
          {showSuccessBanner && importSuccessMessage && (
            <View style={[styles.successBanner, {backgroundColor: colors.successLight}]}>
              <Icon name="check-circle" size={18} color={colors.accent} />
              <Text style={[styles.successBannerText, {color: colors.text}]}>{importSuccessMessage}</Text>
              <TouchableOpacity
                onPress={() => setShowSuccessBanner(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sort Options */}
          <View style={[styles.sortContainer, { borderTopColor: colors.divider }]}>
            <Icon name="sliders" size={14} color={colors.textSecondary} />
            {(['recent', 'name', 'jobs'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.sortOption, sortBy === option && { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}
                onPress={() => setSortBy(option)}>
                <Text style={[styles.sortOptionText, { color: colors.textSecondary }, sortBy === option && { color: colors.accent, fontWeight: theme.fontWeight.semibold }]}>
                  {option === 'recent' ? 'Recent' : option === 'name' ? 'Name' : 'Jobs'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Clients List */}
      <Animated.FlatList
        data={filteredClients as any}
        renderItem={renderClient}
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
          <EmptyState onCreateNew={handleCreateNew} />
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

  // Success Banner
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  successBannerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  importButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },

  // Client Card
  clientCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  avatarText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  clientMainContent: {
    flex: 1,
    gap: 3,
  },
  clientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clientName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  quickActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,

  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: theme.fontSize.sm,

  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,

    paddingTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: theme.fontSize.xs,

  },
  dateText: {
    fontSize: theme.fontSize.xs,

    marginLeft: 'auto',
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
});

export default ClientsListScreen;
