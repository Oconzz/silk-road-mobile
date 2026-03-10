import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { teamService, type TeamMember } from '../services/api/domain/team/teamService';
import { jobAssignmentService, type AssignedTeamMember } from '../services/api/domain/jobAssignment/jobAssignmentService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AssignTeamMembers'>;

interface TeamMemberWithAssignment extends TeamMember {
  isAssigned: boolean;
  isLoading: boolean;
}

export const AssignTeamMembersScreen: React.FC<Props> = ({ navigation, route }) => {
  const { jobId, jobTitle } = route.params;
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [teamResponse, assignments] = await Promise.all([
        teamService.getTeamMembers({ active: true }),
        jobAssignmentService.getJobAssignments(jobId),
      ]);
      const assignedIds = new Set((assignments || []).map((a: AssignedTeamMember) => a.userId));
      setTeamMembers((teamResponse.items || []).map(m => ({ ...m, isAssigned: assignedIds.has(m.id), isLoading: false })));
    } catch { Alert.alert('Error', 'Failed to load'); }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggle = async (m: TeamMemberWithAssignment) => {
    setTeamMembers(prev => prev.map(x => x.id === m.id ? { ...x, isLoading: true } : x));
    try {
      if (m.isAssigned) await jobAssignmentService.unassignTeamMember({ jobId, userId: m.id });
      else await jobAssignmentService.assignTeamMember({ jobId, userId: m.id });
      setTeamMembers(prev => prev.map(x => x.id === m.id ? { ...x, isAssigned: !m.isAssigned, isLoading: false } : x));
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed');
      setTeamMembers(prev => prev.map(x => x.id === m.id ? { ...x, isLoading: false } : x));
    }
  };

  const renderMember = ({ item }: { item: TeamMemberWithAssignment }) => (
    <TouchableOpacity style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}, item.isAssigned && {borderColor: colors.success, backgroundColor: colors.success + '10'}]} onPress={() => toggle(item)} disabled={item.isLoading}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.avatarText, {color: colors.primary}]}>{item.fullName.charAt(0)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, {color: colors.text}]}>{item.fullName}</Text>
          <Text style={[styles.email, {color: colors.textSecondary}]}>{item.email}</Text>
          <Text style={[styles.role, { color: colors.primary }]}>{item.role}</Text>
        </View>
        {item.isLoading ? <ActivityIndicator /> : <Icon name={item.isAssigned ? 'check-circle' : 'plus-circle'} size={24} color={item.isAssigned ? colors.success : colors.textSecondary} />}
      </View>
    </TouchableOpacity>
  );

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader title="Assign Team" onBack={() => navigation.goBack()} />
      <View style={[styles.header, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}><Icon name="briefcase" size={18} color={colors.primary} /><Text style={[styles.jobTitle, { color: colors.text }]}>{jobTitle}</Text></View>
      {loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.accent} /> : (
        <FlatList data={teamMembers} keyExtractor={i => i.id} renderItem={renderMember} contentContainerStyle={{ padding: 16 }} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  jobTitle: { fontSize: 16, fontWeight: '600', marginLeft: 8, flex: 1 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardActive: { },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 14, marginTop: 2 },
  role: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
