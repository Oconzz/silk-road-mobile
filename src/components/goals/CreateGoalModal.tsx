import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { CalendarPicker } from '../ui';
import { useGoal } from '../../context/GoalContext';
import { jobAssignmentService, type AssignedTeamMember } from '../../services/api/domain/jobAssignment/jobAssignmentService';
import type { Goal, CreateGoalRequest, UpdateGoalRequest } from '../../types/goal';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  jobId: string;
  editingGoal?: Goal | null;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  visible,
  onClose,
  onSave,
  jobId,
  editingGoal,
}) => {
  const {colors} = useTheme();
  const { createGoal, updateGoal, isLoading } = useGoal();
  const [jobTeamMembers, setJobTeamMembers] = useState<AssignedTeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [deadline, setDeadline] = useState(new Date());
  const [assignedToUserId, setAssignedToUserId] = useState<string | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      // Load team members assigned to this job
      setLoadingTeam(true);
      jobAssignmentService.getJobAssignments(jobId)
        .then(members => setJobTeamMembers(members))
        .catch(err => console.error('Failed to load job team members:', err))
        .finally(() => setLoadingTeam(false));
      
      if (editingGoal) {
        setTitle(editingGoal.title);
        setDescription(editingGoal.description || '');
        setBonusAmount(editingGoal.bonusAmount?.toString() || '');
        setDeadline(new Date(editingGoal.deadline));
        setAssignedToUserId(editingGoal.assignedToUserId);
      } else {
        resetForm();
      }
    }
  }, [visible, editingGoal, jobId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setBonusAmount('');
    setDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days from now
    setAssignedToUserId(undefined);
    setError(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setError(null);
      if (editingGoal) {
        const updateData: UpdateGoalRequest = {
          title: title.trim(),
          description: description.trim() || undefined,
          deadline: deadline.toISOString(),
          assignedToUserId,
        };
        await updateGoal(editingGoal.id, updateData);
      } else {
        const createData: CreateGoalRequest = {
          jobId,
          title: title.trim(),
          description: description.trim() || undefined,
          bonusAmount: bonusAmount ? parseFloat(bonusAmount) : undefined,
          deadline: deadline.toISOString(),
          assignedToUserId,
        };
        await createGoal(createData);
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save goal');
    }
  };


  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const selectedMember = jobTeamMembers.find(m => m.userId === assignedToUserId);

  return (
    <Modal
      visible={visible}
       animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, {backgroundColor: colors.background}]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, {backgroundColor: colors.background}]}>
            <Icon name="x" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: colors.text}]}>
            {editingGoal ? 'Edit Goal' : 'New Goal'}
          </Text>
          <TouchableOpacity             onPress={handleSave}
            style={[styles.saveBtn, {backgroundColor: colors.accent}, isLoading && styles.saveBtnDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.textLight} />
            ) : (
              <Text style={[styles.saveBtnText, {color: colors.textLight}]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={[styles.errorContainer, {backgroundColor: `${colors.error}10`}]}>
              <Icon name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>Title *</Text>
            <TextInput
              style={[styles.input, {borderColor: colors.border, color: colors.text, backgroundColor: colors.surface}]}
              value={title}
              onChangeText={setTitle}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, {color: colors.text, backgroundColor: colors.surface, borderColor: colors.border}]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add details or instructions..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>Completion Bonus ($)</Text>
            <View style={[styles.currencyInput, {borderColor: colors.border, backgroundColor: colors.surface}]}>
              <Text style={[styles.currencySymbol, {color: colors.text}]}>$</Text>
              <TextInput                 style={[styles.currencyTextInput, {backgroundColor: colors.surface, color: colors.text}]}
                value={bonusAmount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) return;
                  if (parts[1] && parts[1].length > 2) return;
                  setBonusAmount(cleaned);
                }}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>Deadline *</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
              onPress={() => setShowDatePicker(true)}
            >
              <Icon name="calendar" size={18} color={colors.accent} />
              <Text style={[styles.pickerBtnText, {color: colors.text}]}>{formatDate(deadline)}</Text>
              <Icon name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <CalendarPicker
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            onSelectDate={(date) => {
              setDeadline(date);
              setShowDatePicker(false);
            }}
            selectedDate={deadline}
            minimumDate={new Date()}
            title="Goal Deadline"
          />

          <View style={styles.field}>
            <Text style={[styles.label, {color: colors.textSecondary}]}>Assign To</Text>
            <TouchableOpacity
              style={[styles.pickerBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
              onPress={() => setShowTeamPicker(!showTeamPicker)}
            >
              <Icon name="user" size={18} color={colors.accent} />
              <Text style={[styles.pickerBtnText, {color: colors.text}]}>
                {selectedMember ? selectedMember.fullName : 'All Team Members'}
              </Text>
              <Icon
                name={showTeamPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showTeamPicker && (
              <View style={[styles.teamList, {borderColor: colors.border, backgroundColor: colors.surface}]}>
                <TouchableOpacity
                  style={[
                    styles.teamItem,
                    !assignedToUserId && [styles.teamItemSelected, {backgroundColor: `${colors.accent}10`}],
                  ]}
                  onPress={() => {
                    setAssignedToUserId(undefined);
                    setShowTeamPicker(false);
                  }}
                >
                  <View style={[styles.teamItemIcon, {backgroundColor: colors.background}]}>
                    <Icon name="users" size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.teamItemText, {color: colors.text}]}>All Team Members</Text>
                  {!assignedToUserId && (
                    <Icon name="check" size={16} color={colors.accent} />
                  )}
                </TouchableOpacity>

                {loadingTeam ? (
                  <View style={[styles.teamItem, {borderBottomColor: colors.border}]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={[styles.teamItemText, {color: colors.text}]}>Loading...</Text>
                  </View>
                ) : jobTeamMembers.length === 0 ? (
                  <View style={[styles.teamItem, {borderBottomColor: colors.border}]}>
                    <Icon name="info" size={16} color={colors.textSecondary} />
                    <Text style={[styles.teamItemText, { color: colors.textSecondary }]}>No team members assigned to this job</Text>
                  </View>
                ) : (
                  jobTeamMembers.map(member => (
                    <TouchableOpacity
                      key={member.userId}
                      style={[
                        styles.teamItem,
                        assignedToUserId === member.userId && [styles.teamItemSelected, {backgroundColor: `${colors.accent}10`}],
                      ]}
                      onPress={() => {
                        setAssignedToUserId(member.userId);
                        setShowTeamPicker(false);
                      }}
                    >
                      <View style={[styles.teamItemIcon, styles.teamItemAvatar]}>
                        <Text style={[styles.avatarText, {color: colors.text}]}>
                          {member.fullName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.teamItemInfo}>
                        <Text style={[styles.teamItemText, {color: colors.text}]}>{member.fullName}</Text>
                        <Text style={[styles.teamItemRole, {color: colors.text}]}>{member.role}</Text>
                      </View>
                      {assignedToUserId === member.userId && (
                        <Icon name="check" size={16} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          <View style={[styles.infoBox, {backgroundColor: colors.surface}]}>
            <Icon name="info" size={16} color={colors.accent} />
            <Text style={[styles.infoText, {color: colors.text}]}>
              Goals help track project milestones and team progress. When completed,
              they will show whether they were finished on time or late.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,

  },
  closeBtn: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',

  },
  saveBtn: {

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {

    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,

    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    flex: 1,

    fontSize: theme.fontSize.sm,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

    marginBottom: theme.spacing.sm,
  },
  input: {

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  textArea: {
    minHeight: 80,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
  },
  currencySymbol: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',

    marginRight: theme.spacing.xs,
  },
  currencyTextInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  pickerBtnText: {
    flex: 1,
    fontSize: theme.fontSize.md,

  },
  teamList: {

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

    gap: theme.spacing.sm,
  },
  teamItemSelected: {
  },
  teamItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',
  },
  teamItemAvatar: {
  },
  avatarText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

  },
  teamItemInfo: {
    flex: 1,
  },
  teamItemText: {
    fontSize: theme.fontSize.md,

  },
  teamItemRole: {
    fontSize: theme.fontSize.xs,

    textTransform: 'capitalize',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,

    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,

    lineHeight: 20,
  },
});
