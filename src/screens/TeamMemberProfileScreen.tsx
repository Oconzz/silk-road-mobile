import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useTeam } from '../context/TeamContext';
import { ScreenHeader } from '../components/ui';
import { permissionService, type UserPermissionStatus, type PermissionCategory } from '../services/api/domain/permissions/permissionService';
import { timeCardService } from '../services/api/domain/timeCard/timeCardService';
import { formatDuration, formatTimeCardDate, formatTimeCardTime, type TimeCardListItem } from '../types/timeCard';
import type { RootStackParamList } from '../types/navigation';

type TeamMemberProfileRouteProp = RouteProp<{ TeamMemberProfile: { memberId: string } }, 'TeamMemberProfile'>;

const ROLES = [
  { value: 'Crew', label: 'Crew Member' },
  { value: 'Leader', label: 'Team Leader' },
  { value: 'Admin', label: 'Administrator' },
];

const getRoleColor = (role: string, colors: any) => {
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

export const TeamMemberProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<TeamMemberProfileRouteProp>();
  const { memberId } = route.params;
  
  const { selectedMember, loadTeamMember, updateMemberRole, removeMember, isLoading } = useTeam();
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissionStatus[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
  const [memberTimeCards, setMemberTimeCards] = useState<TimeCardListItem[]>([]);
  const [timeCardsLoading, setTimeCardsLoading] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [monthlyHours, setMonthlyHours] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const reloadMember = async () => {
        await loadTeamMember(memberId);
        await loadMemberTimeCards();
      };
      reloadMember();
      return () => {};
    }, [memberId, loadTeamMember])
  );

  const loadMemberTimeCards = useCallback(async () => {
    if (!memberId) return;
    
    try {
      setTimeCardsLoading(true);
      
      // Get this week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Get this month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Load time cards for the member
      const response = await timeCardService.getTimeCards({
        userId: memberId,
        viewTeam: true,
        startDate: startOfMonth.toISOString(),
        endDate: now.toISOString(),
        pageSize: 100,
      });
      
      setMemberTimeCards(response.items || []);
      
      // Calculate weekly hours
      const weeklyCards = response.items.filter(tc => 
        new Date(tc.clockInTime) >= startOfWeek
      );
      const weeklyTotal = weeklyCards.reduce((sum, tc) => sum + (tc.totalHours || 0), 0);
      setWeeklyHours(weeklyTotal);
      
      // Calculate monthly hours
      const monthlyTotal = response.items.reduce((sum, tc) => sum + (tc.totalHours || 0), 0);
      setMonthlyHours(monthlyTotal);
      
    } catch (err: any) {
      console.error('[TeamMemberProfile] Error loading time cards:', err);
    } finally {
      setTimeCardsLoading(false);
    }
  }, [memberId]);

  // Load permissions when expanded
  const loadPermissions = useCallback(async () => {
    if (!memberId) return;
    
    try {
      setPermissionsLoading(true);
      const response = await permissionService.getUserPermissions(memberId);
      setPermissions(response.permissions);
    } catch (err: any) {
      console.error('[TeamMemberProfile] Error loading permissions:', err);
      Alert.alert('Error', 'Failed to load permissions');
    } finally {
      setPermissionsLoading(false);
    }
  }, [memberId]);

  const handleTogglePermissions = useCallback(() => {
    if (!showPermissions && permissions.length === 0) {
      loadPermissions();
    }
    setShowPermissions(!showPermissions);
  }, [showPermissions, permissions.length, loadPermissions]);

  const handlePermissionChange = useCallback(async (permissionKey: string, granted: boolean) => {
    try {
      setUpdatingPermission(permissionKey);
      await permissionService.updatePermission({
        userId: memberId,
        permissionKey,
        granted,
      });
      // Update local state
      setPermissions(prev => prev.map(p => 
        p.permissionKey === permissionKey 
          ? { ...p, granted, isDefault: false }
          : p
      ));
    } catch (err: any) {
      console.error('[TeamMemberProfile] Error updating permission:', err);
      Alert.alert('Error', 'Failed to update permission');
    } finally {
      setUpdatingPermission(null);
    }
  }, [memberId]);

  const handleResetPermissions = useCallback(() => {
    Alert.alert(
      'Reset Permissions',
      'This will reset all permissions to the default for this user\'s role. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              setPermissionsLoading(true);
              await permissionService.resetPermissions(memberId);
              await loadPermissions();
              Alert.alert('Success', 'Permissions reset to defaults');
            } catch (err: any) {
              Alert.alert('Error', 'Failed to reset permissions');
            } finally {
              setPermissionsLoading(false);
            }
          },
        },
      ]
    );
  }, [memberId, loadPermissions]);

  const handleRoleChange = useCallback(async (newRole: string) => {
    setShowRolePicker(false);
    
    if (selectedMember && newRole !== selectedMember.role) {
      const success = await updateMemberRole(memberId, newRole);
      if (success) {
        Alert.alert('Success', 'Role updated successfully');
      }
    }
  }, [selectedMember, memberId, updateMemberRole]);

  const handleRemoveMember = useCallback(() => {
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${selectedMember?.fullName} from your team? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await removeMember(memberId);
            if (success) {
              Alert.alert('Success', 'Team member removed', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            }
          },
        },
      ]
    );
  }, [selectedMember, memberId, removeMember, navigation]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const { colors, isDark } = useTheme();

  if (isLoading && !selectedMember) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Team Member" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedMember) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Team Member" onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text }]}>Team member not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleColor = getRoleColor(selectedMember.role, colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <ScreenHeader title="Team Member" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {selectedMember.personalPhoto ? (
              <Image 
                source={{ uri: selectedMember.personalPhoto }} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: `${roleColor}20` }]}>
                <Text style={[styles.avatarInitials, { color: roleColor }]}>
                  {selectedMember.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.memberName, {color: colors.text}]}>{selectedMember.fullName}</Text>
          
          <TouchableOpacity
            style={[styles.roleBadge, { backgroundColor: `${roleColor}15` }]}
            onPress={() => setShowRolePicker(true)}
          >
            <Text style={[styles.roleText, { color: roleColor }]}>
              {ROLES.find(r => r.value === selectedMember.role)?.label || selectedMember.role}
            </Text>
            <Icon name="chevron-down" size={14} color={roleColor} />
          </TouchableOpacity>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Contact Information</Text>
          
          <View style={[styles.infoCard, {backgroundColor: colors.surface}]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIconWrap, {backgroundColor: `${colors.accent}15`}]}>
                <Icon name="mail" size={18} color={colors.accent} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>Email</Text>
                <Text style={[styles.infoValue, {color: colors.text}]}>{selectedMember.email}</Text>
              </View>
            </View>
            
            {selectedMember.phone && (
              <View style={styles.infoRow}>
                <View style={[styles.infoIconWrap, {backgroundColor: `${colors.accent}15`}]}>
                  <Icon name="phone" size={18} color={colors.accent} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>Phone</Text>
                  <Text style={[styles.infoValue, {color: colors.text}]}>{selectedMember.phone}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.infoRow}>
              <View style={[styles.infoIconWrap, {backgroundColor: `${colors.accent}15`}]}>
                <Icon name="calendar" size={18} color={colors.accent} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, {color: colors.textSecondary}]}>Joined</Text>
                <Text style={[styles.infoValue, {color: colors.text}]}>{formatDate(selectedMember.joinedDate)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Performance</Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, {backgroundColor: colors.surface}]}>
              <Icon name="briefcase" size={24} color={colors.info} />
              <Text style={[styles.statValue, {color: colors.text}]}>{selectedMember.activeJobsCount || 0}</Text>
              <Text style={[styles.statLabel, {color: colors.textSecondary}]}>Active Jobs</Text>
            </View>
            
            <View style={[styles.statCard, {backgroundColor: colors.surface}]}>
              <Icon name="check-circle" size={24} color={colors.success} />
              <Text style={[styles.statValue, {color: colors.text}]}>{selectedMember.completedJobsCount || 0}</Text>
              <Text style={[styles.statLabel, {color: colors.textSecondary}]}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Time Cards Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Time Cards</Text>
          
          <View style={[styles.timeCardsCard, {backgroundColor: colors.surface}]}>
            {timeCardsLoading ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ padding: 20 }} />
            ) : (
              <View style={styles.timeCardsSummary}>
                <View style={styles.timeCardsStat}>
                  <Icon name="clock" size={20} color={colors.accent} />
                  <Text style={[styles.timeCardsValue, {color: colors.text}]}>{formatDuration(weeklyHours)}</Text>
                  <Text style={[styles.timeCardsLabel, {color: colors.textSecondary}]}>Hours This Week</Text>
                </View>
                <View style={[styles.timeCardsDivider, {backgroundColor: colors.border}]} />
                <View style={styles.timeCardsStat}>
                  <Icon name="calendar" size={20} color={colors.info} />
                  <Text style={[styles.timeCardsValue, {color: colors.text}]}>{formatDuration(monthlyHours)}</Text>
                  <Text style={[styles.timeCardsLabel, {color: colors.textSecondary}]}>Hours This Month</Text>
                </View>
              </View>
            )}
            
            <TouchableOpacity 
              style={[styles.exportTimeCardsBtn, {backgroundColor: colors.surface}, {borderTopColor: colors.border}]}
              onPress={async () => {
                try {
                  if (memberTimeCards.length === 0) {
                    Alert.alert('No Data', 'No time cards to export for this member.');
                    return;
                  }
                  
                  // Generate CSV
                  const headers = ['Date', 'Check-In', 'Check-Out', 'Total Hours', 'Overtime', 'Job', 'Status'];
                  const rows = memberTimeCards.map(tc => [
                    formatTimeCardDate(tc.clockInTime),
                    formatTimeCardTime(tc.clockInTime),
                    tc.clockOutTime ? formatTimeCardTime(tc.clockOutTime) : 'Active',
                    formatDuration(tc.totalHours),
                    formatDuration(tc.overtimeHours),
                    tc.jobName || 'N/A',
                    tc.status,
                  ]);
                  
                  // Add summary
                  rows.push([]);
                  rows.push(['SUMMARY', '', '', formatDuration(monthlyHours), '', '', `${memberTimeCards.length} entries`]);
                  
                  const csvContent = [
                    `Time Cards Export - ${selectedMember.fullName}`,
                    `Generated: ${new Date().toLocaleDateString()}`,
                    '',
                    headers.join(','),
                    ...rows.map(row => row.join(','))
                  ].join('\n');
                  
                  await Share.share({ 
                    message: csvContent, 
                    title: `TimeCards_${selectedMember.fullName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv` 
                  });
                } catch (e) {
                  console.error('[Export] Error:', e);
                  Alert.alert('Export Failed', 'Unable to export time cards.');
                }
              }}
            >
              <Icon name="download" size={16} color={colors.accent} />
              <Text style={[styles.exportTimeCardsBtnText, {color: colors.accent}]}>Export Time Cards</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Permissions Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.permissionsSectionHeader, {backgroundColor: colors.surface}]}
            onPress={handleTogglePermissions}
          >
            <View style={styles.permissionsTitleRow}>
              <Icon name="shield" size={20} color={colors.accent} />
              <Text style={[styles.sectionTitle, {color: colors.text}]}>Permissions</Text>
            </View>
            <Icon 
              name={showPermissions ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>

          {showPermissions && (
            <View style={[styles.permissionsContent, {backgroundColor: colors.surface}]}>
              {permissionsLoading ? (
                <View style={styles.permissionsLoading}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.permissionsLoadingText, {color: colors.textSecondary}]}>Loading permissions...</Text>
                </View>
              ) : (
                <>
                  {/* Group permissions by category */}
                  {['Inventory', 'Estimates', 'Clients', 'Jobs', 'Financial', 'Team', 'Time Tracking'].map(category => {
                    const categoryPermissions = permissions.filter(p => p.category === category);
                    if (categoryPermissions.length === 0) return null;
                    
                    return (
                      <View key={category} style={[styles.permissionCategory, {borderBottomColor: colors.border}]}>
                        <Text style={[styles.permissionCategoryTitle, {color: colors.text}]}>{category}</Text>
                        {categoryPermissions.map(perm => (
                          <View key={perm.permissionKey} style={[styles.permissionRow, {borderBottomColor: colors.border}]}>
                            <View style={styles.permissionInfo}>
                              <Text style={[styles.permissionName, {color: colors.text}]}>{perm.permissionName}</Text>
                              {perm.isDefault && (
                                <Text style={[styles.permissionDefault, {color: colors.textSecondary}]}>Default</Text>
                              )}
                            </View>
                            <Switch
                              value={perm.granted}
                              onValueChange={(value) => handlePermissionChange(perm.permissionKey, value)}
                              disabled={updatingPermission === perm.permissionKey}
                              trackColor={{ false: colors.border, true: `${colors.accent}50` }}
                              thumbColor={perm.granted ? colors.accent : colors.surface}
                            />
                          </View>
                        ))}
                      </View>
                    );
                  })}
                  
                  {/* Reset Button */}
                  <TouchableOpacity 
                    style={[styles.resetPermissionsBtn, {backgroundColor: `${colors.warning}10`}, {borderTopColor: colors.border}]}
                    onPress={handleResetPermissions}
                  >
                    <Icon name="rotate-ccw" size={16} color={colors.warning} />
                    <Text style={[styles.resetPermissionsText, {color: colors.warning}]}>Reset to Role Defaults</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          
          
          <TouchableOpacity style={[styles.dangerButton, {backgroundColor: `${colors.error}10`}]} onPress={handleRemoveMember}>
            <Icon name="user-x" size={20} color={colors.error} />
            <Text style={[styles.dangerButtonText, {color: colors.error}]}>Remove from Team</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Role Picker Modal */}
      {showRolePicker && (
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowRolePicker(false)}
        >
          <View style={[styles.modalContent, {backgroundColor: colors.surface}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>Change Role</Text>
            {ROLES.map(role => (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.modalOption,
                  {borderBottomColor: colors.border},
                  selectedMember.role === role.value && {backgroundColor: `${colors.accent}10`},
                ]}
                onPress={() => handleRoleChange(role.value)}
              >
                <Text style={[
                  styles.modalOptionText,
                  {color: colors.text},
                  selectedMember.role === role.value && {color: colors.accent},
                ]}>
                  {role.label}
                </Text>
                {selectedMember.role === role.value && (
                  <Icon name="check" size={20} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity               style={[styles.modalCancelButton, {backgroundColor: colors.surface}, {borderTopColor: colors.border}]}
              onPress={() => setShowRolePicker(false)}
            >
              <Text style={[styles.modalCancelText, {color: colors.textSecondary}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.fontSize.lg,

  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatarContainer: {
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
  },
  memberName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',

  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  roleText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',

  },
  infoCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.fontSize.xs,

  },
  infoValue: {
    fontSize: theme.fontSize.md,

    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',

  },
  statLabel: {
    fontSize: theme.fontSize.sm,

  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,

    borderWidth: 1,

    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  dangerButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',

    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  modalOptionSelected: {
  },
  modalOptionText: {
    fontSize: theme.fontSize.md,

  },
  modalOptionTextSelected: {

    fontWeight: '600',
  },
  modalCancelButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,

  },
  modalCancelText: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
  },
  // Permissions styles
  permissionsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  permissionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  permissionsContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  permissionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  permissionsLoadingText: {
    fontSize: theme.fontSize.sm,

  },
  permissionCategory: {
    marginBottom: theme.spacing.md,
  },
  permissionCategoryTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  permissionInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  permissionName: {
    fontSize: theme.fontSize.md,

  },
  permissionDefault: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  resetPermissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderTopWidth: 1,

  },
  resetPermissionsText: {
    fontSize: theme.fontSize.sm,

    fontWeight: '500',
  },
  // Time Cards styles
  timeCardsCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  timeCardsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  timeCardsStat: {
    alignItems: 'center',
    flex: 1,
  },
  timeCardsValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    marginTop: theme.spacing.xs,
  },
  timeCardsLabel: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  timeCardsDivider: {
    width: 1,
    height: 40,

  },
  exportTimeCardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,

  },
  exportTimeCardsBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
});
