import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Share, ScrollView, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useTimeCard } from '../context/TimeCardContext';
import { useAuth } from '../context/AuthContext';
import { formatDuration, formatTimeCardDate, formatTimeCardTime, type TimeCardListItem } from '../types/timeCard';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';

type FilterPeriod = 'all' | 'today' | 'this_week' | 'this_month' | 'last_month';

const FILTER_OPTIONS: { value: FilterPeriod; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

export const TimeCardsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentCompany } = useAuth();
  const { timeCards, loading, loadTimeCards, loadWeeklySummary } = useTimeCard();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('this_week');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'my' | 'team'>('my');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportAllProjects, setExportAllProjects] = useState(true);
  const [exportSelectedProjects, setExportSelectedProjects] = useState<string[]>([]);
  const [exportAllTeamMembers, setExportAllTeamMembers] = useState(true);
  const [exportSelectedTeamMembers, setExportSelectedTeamMembers] = useState<string[]>([]);
  
  // Check if user is admin
  const role = currentCompany?.role?.toLowerCase() || '';
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'leader';

  // Get unique jobs from time cards
  const availableJobs = useMemo(() => {
    const jobMap = new Map<string, string>();
    timeCards.forEach(tc => {
      if (tc.jobId && tc.jobName) {
        jobMap.set(tc.jobId, tc.jobName);
      }
    });
    return Array.from(jobMap.entries()).map(([id, name]) => ({ id, name }));
  }, [timeCards]);

  // Filter time cards based on selected filters
  const filteredTimeCards = useMemo(() => {
    let filtered = [...timeCards];
    
    // Filter by period
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    switch (selectedPeriod) {
      case 'today':
        filtered = filtered.filter(tc => new Date(tc.clockInTime) >= startOfToday);
        break;
      case 'this_week':
        filtered = filtered.filter(tc => new Date(tc.clockInTime) >= startOfWeek);
        break;
      case 'this_month':
        filtered = filtered.filter(tc => new Date(tc.clockInTime) >= startOfMonth);
        break;
      case 'last_month':
        filtered = filtered.filter(tc => {
          const date = new Date(tc.clockInTime);
          return date >= startOfLastMonth && date <= endOfLastMonth;
        });
        break;
    }

    // Filter by job
    if (selectedJobId) {
      filtered = filtered.filter(tc => tc.jobId === selectedJobId);
    }

    // Filter by team member
    if (selectedMemberId) {
      filtered = filtered.filter(tc => tc.userId === selectedMemberId);
    }

    return filtered;
  }, [timeCards, selectedPeriod, selectedJobId, selectedMemberId]);

  // Calculate filtered summary
  const filteredSummary = useMemo(() => {
    const totalHours = filteredTimeCards.reduce((sum, tc) => sum + tc.totalHours, 0);
    const totalOvertimeHours = filteredTimeCards.reduce((sum, tc) => sum + tc.overtimeHours, 0);
    const uniqueDays = new Set(filteredTimeCards.map(tc => formatTimeCardDate(tc.clockInTime))).size;
    return { totalHours, totalOvertimeHours, totalDays: uniqueDays };
  }, [filteredTimeCards]);

  // Load time cards when viewMode changes, clear member filter when switching away from team
  useEffect(() => {
    if (viewMode !== 'team') {
      setSelectedMemberId(null);
    }
    loadTimeCards({ viewTeam: viewMode === 'team' });
    loadWeeklySummary();
  }, [loadTimeCards, loadWeeklySummary, viewMode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTimeCards({ viewTeam: viewMode === 'team', forceRefresh: true }), loadWeeklySummary()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadTimeCards, loadWeeklySummary, viewMode]);

  // Get unique team members from time cards (for team view)
  const availableTeamMembers = useMemo(() => {
    const memberMap = new Map<string, string>();
    timeCards.forEach(tc => {
      if (tc.userId && tc.userName) {
        memberMap.set(tc.userId, tc.userName);
      }
    });
    return Array.from(memberMap.entries()).map(([id, name]) => ({ id, name }));
  }, [timeCards]);

  // Filter time cards for export based on modal filters
  const getExportData = useCallback(() => {
    let data = [...timeCards];
    
    // Apply date range filter if specified
    if (exportStartDate) {
      const start = new Date(exportStartDate);
      data = data.filter(tc => new Date(tc.clockInTime) >= start);
    }
    if (exportEndDate) {
      const end = new Date(exportEndDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter(tc => new Date(tc.clockInTime) <= end);
    }
    
    // Apply project filter
    if (!exportAllProjects && exportSelectedProjects.length > 0) {
      data = data.filter(tc => tc.jobId && exportSelectedProjects.includes(tc.jobId));
    }
    
    // Apply team member filter
    if (!exportAllTeamMembers && exportSelectedTeamMembers.length > 0) {
      data = data.filter(tc => exportSelectedTeamMembers.includes(tc.userId));
    }
    
    return data;
  }, [timeCards, exportStartDate, exportEndDate, exportAllProjects, exportSelectedProjects, exportAllTeamMembers, exportSelectedTeamMembers]);

  // Open export modal with default dates
  const openExportModal = () => {
    // Set default date range based on selected period
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    switch (selectedPeriod) {
      case 'today':
        setExportStartDate(now.toISOString().split('T')[0]);
        setExportEndDate(now.toISOString().split('T')[0]);
        break;
      case 'this_week':
        setExportStartDate(startOfWeek.toISOString().split('T')[0]);
        setExportEndDate(now.toISOString().split('T')[0]);
        break;
      case 'this_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setExportStartDate(startOfMonth.toISOString().split('T')[0]);
        setExportEndDate(now.toISOString().split('T')[0]);
        break;
      case 'last_month':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        setExportStartDate(startOfLastMonth.toISOString().split('T')[0]);
        setExportEndDate(endOfLastMonth.toISOString().split('T')[0]);
        break;
      default:
        setExportStartDate('');
        setExportEndDate('');
    }
    
    setExportAllProjects(true);
    setExportSelectedProjects([]);
    setExportAllTeamMembers(true);
    setExportSelectedTeamMembers([]);
    setShowExportModal(true);
  };

  // Export time cards as CSV file
  const handleExport = useCallback(() => {
    console.log('[TimeCards] handleExport called');
    const exportData = getExportData();
    console.log('[TimeCards] exportData length:', exportData.length);
    
    if (exportData.length === 0) {
      Alert.alert('No Data', 'No time cards to export with current filters.');
      return;
    }

    // Calculate summary for export
    const totalHours = exportData.reduce((sum, tc) => sum + tc.totalHours, 0);
    const totalOvertimeHours = exportData.reduce((sum, tc) => sum + tc.overtimeHours, 0);
    const uniqueDays = new Set(exportData.map(tc => formatTimeCardDate(tc.clockInTime))).size;

    // Build CSV content with Employee and Project columns
    const headers = ['Date', 'Employee', 'Check-In', 'Check-Out', 'Total Hours', 'Overtime', 'Project'];
    
    const rows = exportData.map(tc => [
      `"${formatTimeCardDate(tc.clockInTime)}"`,
      `"${(tc.userName || 'Unknown').replace(/"/g, '""')}"`,
      `"${formatTimeCardTime(tc.clockInTime)}"`,
      `"${tc.clockOutTime ? formatTimeCardTime(tc.clockOutTime) : 'Active'}"`,
      `"${formatDuration(tc.totalHours)}"`,
      `"${formatDuration(tc.overtimeHours)}"`,
      `"${(tc.jobName || 'N/A').replace(/"/g, '""')}"`,
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['"SUMMARY"', '', '', '', `"${formatDuration(totalHours)}"`, `"${formatDuration(totalOvertimeHours)}"`, `"${uniqueDays} days"`]);

    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(row => row.join(','))].join('\n');

    // Generate filename with date range
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `TimeCards_${dateStr}.csv`;

    // Close modal first, then write file and share
    setShowExportModal(false);
    setTimeout(async () => {
      try {
        // Write CSV to temp file
        const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
        await RNFS.writeFile(filePath, csvContent, 'utf8');
        console.log('[TimeCards] CSV written to:', filePath);

        // Share the file
        if (Platform.OS === 'ios') {
          await Share.share({
            url: `file://${filePath}`,
          });
        } else {
          // Android: share as message with file
          await Share.share({
            title: fileName,
            message: csvContent,
          });
        }
      } catch (error: any) {
        // User cancelled share = not an error
        if (error?.message !== 'User did not share') {
          console.error('[TimeCards] Export error:', error);
          Alert.alert('Error', 'Failed to export time cards. Please try again.');
        }
      }
    }, 500);
  }, [getExportData]);

  const { colors } = useTheme();

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: colors.success + '20', color: colors.success };
      case 'rejected':
        return { bg: colors.error + '20', color: colors.error };
      default:
        return { bg: colors.accent + '20', color: colors.accent };
    }
  };

  const renderTimeCard = ({ item }: { item: TimeCardListItem }) => {
    const statusStyle = getStatusBadgeStyle(item.status);
    return (
      <View style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={[styles.cardHeader, {borderBottomColor: colors.border, backgroundColor: colors.background}]}>
          <Text style={[styles.cardDate, {color: colors.text}]}>{formatTimeCardDate(item.clockInTime)}</Text>
          <View style={styles.headerBadges}>
            {item.overtimeHours > 0 && (
              <View style={[styles.otBadge, {backgroundColor: colors.warning + '20'}]}>
                <Text style={[styles.otBadgeText, {color: colors.warning}]}>+{formatDuration(item.overtimeHours)} OT</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                {item.status === 'pending' ? 'Completed' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.cardBody, {backgroundColor: colors.surface}]}>
          <View style={styles.timeRow}>
            <View style={styles.timeBlock}>
              <Icon name="log-in" size={14} color={colors.success} />
              <Text style={[styles.timeLabel, {color: colors.textSecondary}]}>In</Text>
              <Text style={[styles.timeValue, {color: colors.text}]}>{formatTimeCardTime(item.clockInTime)}</Text>
            </View>
            <View style={[styles.timeDivider, {backgroundColor: colors.border}]} />
            <View style={styles.timeBlock}>
              <Icon name="log-out" size={14} color={colors.error} />
              <Text style={[styles.timeLabel, {color: colors.textSecondary}]}>Out</Text>
              <Text style={[styles.timeValue, {color: colors.text}]}>
                {item.clockOutTime ? formatTimeCardTime(item.clockOutTime) : '--:--'}
              </Text>
            </View>
            <View style={[styles.timeDivider, {backgroundColor: colors.border}]} />
            <View style={styles.timeBlock}>
              <Icon name="clock" size={14} color={colors.accent} />
              <Text style={[styles.timeLabel, {color: colors.textSecondary}]}>Total</Text>
              <Text style={[styles.timeValue, {color: colors.primary}]}>{formatDuration(item.billableHours)}</Text>
            </View>
          </View>
          {viewMode === 'team' && (
            <View style={[styles.jobRow, {borderTopColor: colors.border}]}>
              <Icon name="user" size={12} color={colors.textSecondary} />
              <Text style={[styles.jobName, {color: colors.textSecondary}]}>{item.userName}</Text>
            </View>
          )}
          {item.jobName && (
            <View style={[styles.jobRow, {borderTopColor: colors.border}]}>
              <Icon name="briefcase" size={12} color={colors.textSecondary} />
              <Text style={[styles.jobName, {color: colors.textSecondary}]}>{item.jobName}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      {/* Period Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {FILTER_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[styles.filterChip, {backgroundColor: colors.surface, borderColor: colors.border}, selectedPeriod === option.value && {backgroundColor: colors.accent, borderColor: colors.accent}]}
            onPress={() => setSelectedPeriod(option.value)}
          >
            <Text style={[styles.filterChipText, {color: colors.text}, selectedPeriod === option.value && styles.filterChipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Team Member Filter (only in team view) */}
      {viewMode === 'team' && availableTeamMembers.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, styles.filterChipJob, {backgroundColor: colors.surface, borderColor: colors.border}, !selectedMemberId && {backgroundColor: colors.accent, borderColor: colors.accent}]}
            onPress={() => setSelectedMemberId(null)}
          >
            <Icon name="users" size={12} color={!selectedMemberId ? '#fff' : colors.textSecondary} />
            <Text style={[styles.filterChipText, {color: colors.text}, !selectedMemberId && styles.filterChipTextActive]}>All Members</Text>
          </TouchableOpacity>
          {availableTeamMembers.map(member => (
            <TouchableOpacity
              key={member.id}
              style={[styles.filterChip, styles.filterChipJob, {backgroundColor: colors.surface, borderColor: colors.border}, selectedMemberId === member.id && {backgroundColor: colors.accent, borderColor: colors.accent}]}
              onPress={() => setSelectedMemberId(member.id)}
            >
              <Icon name="user" size={12} color={selectedMemberId === member.id ? '#fff' : colors.textSecondary} />
              <Text style={[styles.filterChipText, {color: colors.text}, selectedMemberId === member.id && styles.filterChipTextActive]} numberOfLines={1}>
                {member.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Job Filter */}
      {availableJobs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, styles.filterChipJob, {backgroundColor: colors.surface, borderColor: colors.border}, !selectedJobId && {backgroundColor: colors.accent, borderColor: colors.accent}]}
            onPress={() => setSelectedJobId(null)}
          >
            <Icon name="briefcase" size={12} color={!selectedJobId ? '#fff' : colors.textSecondary} />
            <Text style={[styles.filterChipText, {color: colors.text}, !selectedJobId && styles.filterChipTextActive]}>All Jobs</Text>
          </TouchableOpacity>
          {availableJobs.map(job => (
            <TouchableOpacity
              key={job.id}
              style={[styles.filterChip, styles.filterChipJob, {backgroundColor: colors.surface, borderColor: colors.border}, selectedJobId === job.id && {backgroundColor: colors.accent, borderColor: colors.accent}]}
              onPress={() => setSelectedJobId(job.id)}
            >
              <Text style={[styles.filterChipText, {color: colors.text}, selectedJobId === job.id && styles.filterChipTextActive]} numberOfLines={1}>
                {job.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderSummary = () => (
    <View style={[styles.summaryCard, {backgroundColor: colors.accent}]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryTitle, {color: 'rgba(255,255,255,0.8)'}]}>
          {FILTER_OPTIONS.find(o => o.value === selectedPeriod)?.label || 'Summary'}
        </Text>
        <TouchableOpacity style={styles.exportBtn} onPress={openExportModal}>
          <Icon name="share" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, {color: colors.textLight}]}>{formatDuration(filteredSummary.totalHours)}</Text>
          <Text style={[styles.summaryLabel, {color: 'rgba(255,255,255,0.7)'}]}>Total Hours</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, {color: colors.textLight}]}>{filteredSummary.totalDays}</Text>
          <Text style={[styles.summaryLabel, {color: 'rgba(255,255,255,0.7)'}]}>Days Worked</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, {color: colors.textLight}, filteredSummary.totalOvertimeHours > 0 ? styles.otValue : null]}>
            {formatDuration(filteredSummary.totalOvertimeHours)}
          </Text>
          <Text style={[styles.summaryLabel, {color: 'rgba(255,255,255,0.7)'}]}>Overtime</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader 
        title="Time Cards" 
        onBack={() => navigation.goBack()}
        rightAction={
          isAdmin ? (
            <TouchableOpacity 
              style={styles.viewModeToggle}
              onPress={() => setViewMode(viewMode === 'my' ? 'team' : 'my')}
            >
              <Icon name={viewMode === 'my' ? 'user' : 'users'} size={20} color={colors.accent} />
            </TouchableOpacity>
          ) : undefined
        }
      />
      
      {/* Admin View Mode Indicator */}
      {isAdmin && (
        <View style={[styles.viewModeBar, {backgroundColor: colors.surface}]}>
          <TouchableOpacity 
            style={[styles.viewModeBtn, viewMode === 'my' && {backgroundColor: colors.accent}]}
            onPress={() => setViewMode('my')}
          >
            <Icon name="user" size={14} color={viewMode === 'my' ? colors.textLight : colors.textSecondary} />
            <Text style={[styles.viewModeBtnText, {color: colors.textSecondary}, viewMode === 'my' && {color: colors.textLight}]}>My Time</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.viewModeBtn, viewMode === 'team' && {backgroundColor: colors.accent}]}
            onPress={() => setViewMode('team')}
          >
            <Icon name="users" size={14} color={viewMode === 'team' ? colors.textLight : colors.textSecondary} />
            <Text style={[styles.viewModeBtnText, {color: colors.textSecondary}, viewMode === 'team' && {color: colors.textLight}]}>Team</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {loading && timeCards.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredTimeCards}
          keyExtractor={item => item.id}
          renderItem={renderTimeCard}
          ListHeaderComponent={() => (
            <>
              {renderFilters()}
              {renderSummary()}
            </>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
              <Icon name="clock" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, {color: colors.text}]}>No Time Cards</Text>
              <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>Clock in to start tracking your time</Text>
            </View>
          }
        />
      )}
      
      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
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
              <View style={[styles.dateRangeDisplay, {backgroundColor: colors.background, borderColor: colors.border}]}>
                <View style={styles.dateColumn}>
                  <Text style={[styles.dateColumnLabel, {color: colors.textSecondary}]}>From</Text>
                  <Text style={[styles.dateColumnValue, {color: colors.text}]}>
                    {exportStartDate ? new Date(exportStartDate).toLocaleDateString() : '--'}
                  </Text>
                </View>
                <Icon name="arrow-right" size={20} color={colors.textSecondary} />
                <View style={styles.dateColumn}>
                  <Text style={[styles.dateColumnLabel, {color: colors.textSecondary}]}>To</Text>
                  <Text style={[styles.dateColumnValue, {color: colors.text}]}>
                    {exportEndDate ? new Date(exportEndDate).toLocaleDateString() : '--'}
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
                <View style={[styles.checkbox, {borderColor: colors.border}, exportAllProjects && {backgroundColor: colors.accent, borderColor: colors.accent}]}>
                  {exportAllProjects && <Icon name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkboxLabel, {color: colors.text}]}>All Projects</Text>
              </TouchableOpacity>
              
              {!exportAllProjects && availableJobs.length > 0 && (
                <View style={[styles.selectorList, {borderLeftColor: colors.border}]}>
                  {availableJobs.map(job => (
                    <TouchableOpacity
                      key={job.id}
                      style={styles.checkboxRow}
                      onPress={() => {
                        setExportSelectedProjects(prev =>
                          prev.includes(job.id)
                            ? prev.filter(id => id !== job.id)
                            : [...prev, job.id]
                        );
                      }}
                    >
                      <View style={[styles.checkbox, {borderColor: colors.border}, exportSelectedProjects.includes(job.id) && {backgroundColor: colors.accent, borderColor: colors.accent}]}>
                        {exportSelectedProjects.includes(job.id) && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.checkboxLabel, {color: colors.text}]} numberOfLines={1}>{job.name}</Text>
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
                <View style={[styles.checkbox, {borderColor: colors.border}, exportAllTeamMembers && {backgroundColor: colors.accent, borderColor: colors.accent}]}>
                  {exportAllTeamMembers && <Icon name="check" size={14} color="#fff" />}
                </View>
                <Text style={[styles.checkboxLabel, {color: colors.text}]}>All Team Members</Text>
              </TouchableOpacity>
              
              {!exportAllTeamMembers && availableTeamMembers.length > 0 && (
                <View style={[styles.selectorList, {borderLeftColor: colors.border}]}>
                  {availableTeamMembers.map(member => (
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
                      <View style={[styles.checkbox, {borderColor: colors.border}, exportSelectedTeamMembers.includes(member.id) && {backgroundColor: colors.accent, borderColor: colors.accent}]}>
                        {exportSelectedTeamMembers.includes(member.id) && <Icon name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.checkboxLabel, {color: colors.text}]} numberOfLines={1}>{member.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {/* Export Preview */}
              <Text style={[styles.exportPreviewText, {color: colors.textSecondary}]}>
                Export will include time cards for {exportAllTeamMembers ? availableTeamMembers.length : exportSelectedTeamMembers.length} team member{(exportAllTeamMembers ? availableTeamMembers.length : exportSelectedTeamMembers.length) !== 1 ? 's' : ''}
              </Text>
            </ScrollView>
            
            {/* Export Button */}
            <TouchableOpacity style={[styles.exportButton, {backgroundColor: colors.accent}]} onPress={handleExport}>
              <Icon name="download" size={18} color="#fff" />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 120 : 100 },
  summaryCard: {

    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  exportBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  otValue: { },
  card: {

    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,

    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,

  },
  cardDate: { fontSize: 14, fontWeight: '600' },
  headerBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  otBadge: {

    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  otBadgeText: { fontSize: 11, fontWeight: '600' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  cardBody: { padding: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeBlock: { flex: 1, alignItems: 'center' },
  timeDivider: { width: 1, height: 30 },
  timeLabel: { fontSize: 11, marginTop: 4 },
  timeValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  totalValue: { },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,

    gap: 6,
  },
  jobName: { fontSize: 13 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 8 },
  filtersContainer: { marginBottom: 16 },
  filterScroll: { marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,

    borderWidth: 1,

    marginRight: 8,
  },
  filterChipActive: {
  },
  filterChipJob: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 150,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',

  },
  filterChipTextActive: {
    color: '#fff',
  },
  viewModeToggle: {
    padding: 4,
  },
  viewModeBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,

    borderRadius: 8,
    padding: 4,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewModeBtnActive: {
  },
  viewModeBtnText: {
    fontSize: 13,
    fontWeight: '500',

  },
  viewModeBtnTextActive: {
  },
  
  // Export Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {

    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalScrollContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',

  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',

    marginTop: 16,
    marginBottom: 8,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,

    borderRadius: 12,
    borderWidth: 1,

  },
  dateColumn: {
    alignItems: 'center',
  },
  dateColumnLabel: {
    fontSize: 12,

    marginBottom: 4,
  },
  dateColumnValue: {
    fontSize: 16,
    fontWeight: '600',

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
  exportPreviewText: {
    fontSize: 13,

    marginTop: 16,
    textAlign: 'center',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,

    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
