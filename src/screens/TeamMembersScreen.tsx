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
  Image,
  Alert,
  Modal,
  Share,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useJob } from '../context/JobContext';
import Icon from 'react-native-vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useTeam } from '../context/TeamContext';
import { AnimatedPressable } from '../components/ui';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeCardService } from '../services/api/domain/timeCard/timeCardService';
import { formatDuration, formatTimeCardDate, formatTimeCardTime } from '../types/timeCard';
import type { RootStackParamList } from '../types/navigation';
import type { TeamMember } from '../services/api/domain/team/teamService';
import { useFreemiumLimits } from '../hooks/useFreemiumLimits';

const getRoleColor = (role: string, colors: ReturnType<typeof import('../context/ThemeContext').useTheme>['colors']) => {
  switch (role.toLowerCase()) {
    case 'admin':
    case 'superadmin':
      return colors.accent;
    case 'leader':
      return colors.warning;
    case 'crew':
      return colors.info;
    default:
      return colors.textSecondary;
  }
};

const getRoleLabel = (role: string) => {
  switch (role.toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'superadmin':
      return 'Super Admin';
    case 'leader':
      return 'Team Leader';
    case 'crew':
      return 'Crew Member';
    default:
      return role;
  }
};

interface TeamMemberCardProps {
  member: TeamMember;
  onPress: () => void;
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ member, onPress }) => {
  const { colors } = useTheme();
  const roleColor = getRoleColor(member.role, colors);
  
  return (
    <AnimatedPressable style={[styles.memberCard, {backgroundColor: colors.surface}]} onPress={onPress}>
      <View style={styles.avatarContainer}>
        {member.personalPhotoThumbnail ? (
          <Image 
            source={{ uri: member.personalPhotoThumbnail }} 
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: `${roleColor}20` }]}>
            <Text style={[styles.avatarInitials, { color: roleColor }]}>
              {member.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, {color: colors.text}]} numberOfLines={1}>{member.fullName}</Text>
        <Text style={[styles.memberEmail, {color: colors.textSecondary}]} numberOfLines={1}>{member.email}</Text>
        <View style={styles.memberMeta}>
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}15` }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>
              {getRoleLabel(member.role)}
            </Text>
          </View>
        </View>
      </View>
      
      <Icon name="chevron-right" size={20} color={colors.textSecondary} />
    </AnimatedPressable>
  );
};

const EmptyState: React.FC<{ onInvite: () => void }> = ({ onInvite }) => {
  const { colors } = useTheme();
  return (
  <View style={styles.emptyState}>
    <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
      <Icon name="users" size={48} color={colors.textSecondary} />
    </View>
    <Text style={[styles.emptyTitle, {color: colors.text}]}>No Team Members Yet</Text>
    <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
      Invite your first team member to start building your crew
    </Text>
    <TouchableOpacity style={[styles.emptyButton, {backgroundColor: colors.accent}]} onPress={onInvite}>
      <Icon name="user-plus" size={20} color="#FFFFFF" />
      <Text style={[styles.emptyButtonText, {color: '#FFFFFF'}]}>Invite Team Member</Text>
    </TouchableOpacity>
  </View>
  );
};

const SeatBannerSection: React.FC<{
  isSubscribed: boolean;
  teamMembers: TeamMember[];
  checkSeats: (count: number) => { availableSeats: number };
  seatInfo: { totalSeats: number };
  colors: any;
  navigation: any;
  filteredCount: number;
}> = ({ isSubscribed, teamMembers, checkSeats, seatInfo, colors, navigation, filteredCount }) => {
  if (isSubscribed) {
    const available = checkSeats(teamMembers.length).availableSeats;
    const usagePercent = Math.min(100, (teamMembers.length / seatInfo.totalSeats) * 100);
    const barColor = available === 0 ? colors.error : available <= 2 ? colors.warning : colors.accent;
    return (
      <View>
        <View style={[styles.seatBanner, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <View style={styles.seatBannerHeader}>
            <View style={styles.seatBannerLeft}>
              <Icon name="users" size={16} color={colors.accent} />
              <Text style={[styles.seatBannerTitle, {color: colors.text}]}>Team Seats</Text>
            </View>
            <Text style={[styles.seatBannerCount, {color: colors.accent}]}>
              {teamMembers.length} / {seatInfo.totalSeats}
            </Text>
          </View>
          <View style={[styles.seatProgressBg, {backgroundColor: colors.border}]}>
            <View style={[styles.seatProgressFill, { backgroundColor: barColor, width: `${usagePercent}%` }]} />
          </View>
          <View style={styles.seatStatsRow}>
            <View style={[styles.seatStatBox, {backgroundColor: `${barColor}12`}]}>
              <Text style={[styles.seatStatNumber, {color: barColor}]}>{available}</Text>
              <Text style={[styles.seatStatLabel, {color: colors.textSecondary}]}>remaining</Text>
            </View>
            <View style={[styles.seatStatBox, {backgroundColor: `${colors.accent}12`}]}>
              <Text style={[styles.seatStatNumber, {color: colors.accent}]}>{teamMembers.length}</Text>
              <Text style={[styles.seatStatLabel, {color: colors.textSecondary}]}>active</Text>
            </View>
            <View style={[styles.seatStatBox, {backgroundColor: `${colors.accent}12`}]}>
              <Text style={[styles.seatStatNumber, {color: colors.accent}]}>{seatInfo.totalSeats}</Text>
              <Text style={[styles.seatStatLabel, {color: colors.textSecondary}]}>total</Text>
            </View>
          </View>
          {available === 0 && (
            <TouchableOpacity
              style={[styles.seatUpgradeBtn, {backgroundColor: colors.error}]}
              onPress={() => navigation.navigate('PlanSelection', {fromRegistration: false})}
            >
              <Icon name="plus-circle" size={14} color="#fff" />
              <Text style={styles.seatUpgradeBtnText}>Add More Seats</Text>
            </TouchableOpacity>
          )}
          {available > 0 && available <= 2 && (
            <Text style={[styles.seatWarning, {color: colors.warning}]}>
              Only {available} seat{available === 1 ? '' : 's'} remaining
            </Text>
          )}
        </View>
        <View style={styles.countContainer}>
          <Text style={[styles.countText, {color: colors.textSecondary}]}>
            {filteredCount} {filteredCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <TouchableOpacity
        style={[styles.seatBanner, styles.seatBannerFreemium, {backgroundColor: `${colors.warning}10`, borderColor: colors.warning}]}
        onPress={() => navigation.navigate('PlanSelection', {fromRegistration: false})}
        activeOpacity={0.7}
      >
        <View style={styles.seatBannerHeader}>
          <View style={styles.seatBannerLeft}>
            <Icon name="lock" size={16} color={colors.warning} />
            <Text style={[styles.seatBannerTitle, {color: colors.warning}]}>Free Plan</Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.warning} />
        </View>
        <Text style={[styles.seatBannerDesc, {color: colors.textSecondary}]}>
          Subscribe to invite team members and unlock unlimited access.
        </Text>
      </TouchableOpacity>
     
    </View>
  );
};

export const TeamMembersScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { teamMembers, isLoading, loadTeamMembers, isAdmin } = useTeam();
  const { isSubscribed, checkSeats, seatInfo } = useFreemiumLimits();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 14)),
    end: new Date(),
  });
  const [exportAllProjects, setExportAllProjects] = useState(true);
  const [exportSelectedProjects, setExportSelectedProjects] = useState<string[]>([]);
  const [exportAllTeamMembers, setExportAllTeamMembers] = useState(true);
  const [exportSelectedTeamMembers, setExportSelectedTeamMembers] = useState<string[]>([]);
  
  const { jobs } = useJob();
  
  // Get available projects/jobs for export filter
  const availableProjects = useMemo(() => {
    return jobs.map(job => ({ id: job.id, name: job.title || job.estimateTitle || `Job #${job.id.slice(0, 8)}` }));
  }, [jobs]);
  
  // Get team members to export based on selection
  const membersToExport = useMemo(() => {
    if (exportAllTeamMembers) return teamMembers;
    return teamMembers.filter(m => exportSelectedTeamMembers.includes(m.id));
  }, [teamMembers, exportAllTeamMembers, exportSelectedTeamMembers]);

  const handleExportTimeCards = useCallback(async () => {
    try {
      if (membersToExport.length === 0) {
        Alert.alert('No Data', 'No team members selected to export time cards for.');
        return;
      }

      setShowExportModal(false);
      Alert.alert('Exporting...', 'Gathering time cards data. This may take a moment.');
      
      const startStr = exportDateRange.start.toLocaleDateString();
      const endStr = exportDateRange.end.toLocaleDateString();
      
      // Fetch time cards for selected team members
      const allTimeCards = await Promise.all(
        membersToExport.map(async (member) => {
          try {
            const response = await timeCardService.getTimeCards({
              userId: member.id,
              viewTeam: true,
              startDate: exportDateRange.start.toISOString(),
              endDate: exportDateRange.end.toISOString(),
              pageSize: 500,
            });
            return {
              member,
              timeCards: response.items || [],
            };
          } catch (err) {
            console.error(`[Export] Error loading time cards for ${member.fullName}:`, err);
            return { member, timeCards: [] };
          }
        })
      );
      
      // Generate CSV
      const csvLines: string[] = [
        `Team Time Cards Export`,
        `Period: ${startStr} - ${endStr}`,
        `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        ``,
        `Member,Date,Check-In,Check-Out,Total Hours,Overtime,Project,Status`,
      ];
      
      let totalHours = 0;
      let totalOvertime = 0;
      let totalEntries = 0;
      
      allTimeCards.forEach(({ member, timeCards }) => {
        // Filter by selected projects if not all projects
        const filteredCards = exportAllProjects 
          ? timeCards 
          : timeCards.filter(tc => tc.jobId && exportSelectedProjects.includes(tc.jobId));
        
        filteredCards.forEach(tc => {
          csvLines.push([
            member.fullName,
            formatTimeCardDate(tc.clockInTime),
            formatTimeCardTime(tc.clockInTime),
            tc.clockOutTime ? formatTimeCardTime(tc.clockOutTime) : 'Active',
            formatDuration(tc.totalHours),
            formatDuration(tc.overtimeHours),
            tc.jobName || 'N/A',
            tc.status,
          ].join(','));
          
          totalHours += tc.totalHours || 0;
          totalOvertime += tc.overtimeHours || 0;
          totalEntries++;
        });
      });
      
      // Add summary
      csvLines.push('');
      csvLines.push(`SUMMARY`);
      csvLines.push(`Total Entries:,${totalEntries}`);
      csvLines.push(`Total Hours:,${formatDuration(totalHours)}`);
      csvLines.push(`Total Overtime:,${formatDuration(totalOvertime)}`);
      csvLines.push(`Team Members:,${membersToExport.length}`);
      
      const csvContent = csvLines.join('\n');
      
      await Share.share({
        message: csvContent,
        title: `TeamTimeCards_${exportDateRange.start.toISOString().split('T')[0]}_to_${exportDateRange.end.toISOString().split('T')[0]}.csv`,
      });
      
    } catch (error) {
      console.error('[Export] Error:', error);
      Alert.alert('Export Failed', 'Unable to export time cards. Please try again.');
    }
  }, [exportDateRange, membersToExport, exportAllProjects, exportSelectedProjects]);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'Only administrators can access team management.');
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) {
        loadTeamMembers();
      }
    }, [loadTeamMembers, isAdmin])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTeamMembers();
    } finally {
      setRefreshing(false);
    }
  }, [loadTeamMembers]);

  const handleInvite = useCallback(() => {
    navigation.navigate('InviteTeamMember' as any);
  }, [navigation]);

  const handleImportContacts = useCallback(() => {
    navigation.navigate('TeamContactImport' as any);
  }, [navigation]);

  const handleMemberPress = useCallback((member: TeamMember) => {
    navigation.navigate('TeamMemberProfile' as any, { memberId: member.id });
  }, [navigation]);

  // Filter members
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = searchQuery === '' ||
      member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = !filterRole || member.role.toLowerCase() === filterRole.toLowerCase();
    
    return matchesSearch && matchesRole;
  });

  const roleFilters = [
    { key: null, label: 'All' },
    { key: 'admin', label: 'Admins' },
    { key: 'leader', label: 'Leaders' },
    { key: 'crew', label: 'Crew' },
  ];

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

  if (!isAdmin) {
    return null;
  }

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
                  <Icon name="users" size={14} color={colors.accent} />
                  <Text style={[styles.headerLabel, { color: colors.accent }]}>TEAM MEMBERS</Text>
                </View>
                <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
                  {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setShowExportModal(true)} style={[styles.headerBtn, {backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1}]}>
                <Icon name="download" size={16} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImportContacts} style={[styles.headerBtn, {backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1}]}>
                <Icon name="upload" size={16} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleInvite} style={[styles.addButton, {backgroundColor: colors.accent}]}>
                <Icon name="user-plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Icon name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by name or email..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Role Filters */}
          <View style={[styles.sortContainer, { borderTopColor: colors.divider }]}>
            <Icon name="sliders" size={14} color={colors.textSecondary} />
            {roleFilters.map(filter => {
              const isActive = filterRole === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key ?? 'all'}
                  style={[styles.sortOption, isActive && { backgroundColor: `${colors.accent}10`, borderColor: colors.accent }]}
                  onPress={() => setFilterRole(filter.key)}
                >
                  <Text style={[styles.sortOptionText, { color: colors.textSecondary }, isActive && { color: colors.accent, fontWeight: theme.fontWeight.semibold }]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>

      {/* Members List */}
      <Animated.FlatList
        data={filteredMembers as any}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: any) => (
          <TeamMemberCard member={item} onPress={() => handleMemberPress(item)} />
        )}
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
        ListHeaderComponent={
          <SeatBannerSection
            isSubscribed={isSubscribed}
            teamMembers={teamMembers}
            checkSeats={checkSeats}
            seatInfo={seatInfo}
            colors={colors}
            navigation={navigation}
            filteredCount={filteredMembers.length}
          />
        }
        ListEmptyComponent={!isLoading ? <EmptyState onInvite={handleInvite} /> : null}
      />

      {/* Export Time Cards Modal */}
      <Modal
        visible={showExportModal}
         animationType="fade"
        transparent={true}
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colors.surface}]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.text}]}>Export Time Cards</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Icon name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollContent}>
              {/* Date Range */}
              <Text style={[styles.modalLabel, {color: colors.textSecondary}]}>Date Range</Text>
              <View style={[styles.dateRangeRow, {backgroundColor: colors.background, borderColor: colors.border}]}>
                <View style={styles.dateField}>
                  <Text style={[styles.dateLabel, {color: colors.textSecondary}]}>From</Text>
                  <Text style={[styles.dateValue, {color: colors.text}]}>
                    {exportDateRange.start.toLocaleDateString()}
                  </Text>
                </View>
                <Icon name="arrow-right" size={16} color={colors.textSecondary} />
                <View style={styles.dateField}>
                  <Text style={[styles.dateLabel, {color: colors.textSecondary}]}>To</Text>
                  <Text style={[styles.dateValue, {color: colors.text}]}>
                    {exportDateRange.end.toLocaleDateString()}
                  </Text>
                </View>
              </View>
              
              {/* Project Selector */}
              <Text style={[styles.modalLabel, {color: colors.textSecondary}]}>Projects</Text>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  setExportAllProjects(!exportAllProjects);
                  if (!exportAllProjects) {
                    setExportSelectedProjects([]);
                  }
                }}
              >
                <View style={[styles.checkbox, {borderColor: colors.border}, exportAllProjects && styles.checkboxChecked]}>
                  {exportAllProjects && <Icon name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkboxLabel, {color: colors.text}]}>All Projects</Text>
              </TouchableOpacity>
              
              {!exportAllProjects && availableProjects.length > 0 && (
                <View style={styles.selectorList}>
                  {availableProjects.map(project => (
                    <TouchableOpacity
                      key={project.id}
                      style={styles.checkboxRow}
                      onPress={() => {
                        setExportSelectedProjects(prev =>
                          prev.includes(project.id)
                            ? prev.filter(id => id !== project.id)
                            : [...prev, project.id]
                        );
                      }}
                    >
                      <View style={[styles.checkbox, {borderColor: colors.border}, exportSelectedProjects.includes(project.id) && styles.checkboxChecked]}>
                        {exportSelectedProjects.includes(project.id) && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.checkboxLabel, {color: colors.text}]} numberOfLines={1}>{project.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Team Member Selector */}
              <Text style={[styles.modalLabel, {color: colors.textSecondary}]}>Team Members</Text>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  setExportAllTeamMembers(!exportAllTeamMembers);
                  if (!exportAllTeamMembers) {
                    setExportSelectedTeamMembers([]);
                  }
                }}
              >
                <View style={[styles.checkbox, {borderColor: colors.border}, exportAllTeamMembers && styles.checkboxChecked]}>
                  {exportAllTeamMembers && <Icon name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkboxLabel, {color: colors.text}]}>All Team Members</Text>
              </TouchableOpacity>
              
              {!exportAllTeamMembers && teamMembers.length > 0 && (
                <View style={styles.selectorList}>
                  {teamMembers.map(member => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.checkboxRow}
                      onPress={() => {
                        setExportSelectedTeamMembers(prev =>
                          prev.includes(member.id)
                            ? prev.filter(id => id !== member.id)
                            : [...prev, member.id]
                        );
                      }}
                    >
                      <View style={[styles.checkbox, {borderColor: colors.border}, exportSelectedTeamMembers.includes(member.id) && styles.checkboxChecked]}>
                        {exportSelectedTeamMembers.includes(member.id) && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.checkboxLabel, {color: colors.text}]} numberOfLines={1}>{member.fullName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Export Preview */}
              <Text style={[styles.modalInfo, {color: colors.textSecondary}]}>
                Export will include time cards for {exportAllTeamMembers ? teamMembers.length : exportSelectedTeamMembers.length} team member{(exportAllTeamMembers ? teamMembers.length : exportSelectedTeamMembers.length) !== 1 ? 's' : ''}
              </Text>
            </ScrollView>
            
            <TouchableOpacity style={[styles.exportBtn, {backgroundColor: colors.accent}]} onPress={handleExportTimeCards}>
              <Icon name="download" size={18} color={colors.textLight} />
              <Text style={[styles.exportBtnText, {color: colors.textLight}]}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.xs,
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
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    paddingTop: theme.spacing.sm,
  },
  sortOption: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortOptionText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  countText: {
    fontSize: theme.fontSize.sm,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  avatarContainer: {
    width: 50,
    height: 50,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
  memberEmail: {
    fontSize: theme.fontSize.sm,

  },
  memberMeta: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  roleText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,

    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',

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
    gap: theme.spacing.sm,

    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  emptyButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,

    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {

    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    maxHeight: '80%',
  },
  modalScrollContent: {
    flexGrow: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  modalLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  dateField: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: theme.fontSize.xs,

    marginBottom: 2,
  },
  dateValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  modalInfo: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
  },
  checkboxLabel: {
    fontSize: 15,

    flex: 1,
  },
  selectorList: {
    marginLeft: 34,
    borderLeftWidth: 2,

    paddingLeft: 12,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,

    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  exportBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  seatBanner: {
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
  seatBannerFreemium: {
    borderStyle: 'dashed' as const,
  },
  seatBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seatBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  seatBannerTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  seatBannerCount: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  seatBannerDesc: {
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  seatProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  seatProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  seatWarning: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  seatStatsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  seatStatBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  seatStatNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
  },
  seatStatLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  seatUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  seatUpgradeBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: '#fff',
  },
});
