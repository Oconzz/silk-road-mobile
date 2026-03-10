import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
  Image,
  Dimensions,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { jobAssignmentService, type AssignedTeamMember } from '../services/api/domain/jobAssignment/jobAssignmentService';
import { useJob } from '../context/JobContext';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { ScreenHeader, ConfirmationModal, InlineEditableTitle, JobCompletionModal, CollectPaymentButton, PaymentConfirmationModal } from '../components/ui';
import { PaymentHistorySection } from '../components/PaymentHistorySection';
import { squarePaymentService } from '../services/api/domain/squarePayment';
import type { Payment } from '../types/payment';
import type { AllocationUpdate } from '../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { JobStatus, JobMilestone, JobLineItem, InventoryAllocation, JobListItem, JobOccurrencesResponse } from '../types/job';
import { getJobStatusColor, getJobStatusLabel, parseRRuleToHuman } from '../types/job';
import { EstimateGallery } from '../components/EstimateGallery';
import { JobGallery } from '../components/JobGallery';
import { ClockInOutWidget } from '../components/ClockInOutWidget';
import { GoalSection } from '../components/goals';

// ===== Section Header Component =====
interface SectionHeaderProps {
  title: string;
  icon: string;
  rightAction?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  rightAction,
  collapsed,
  onToggle,
}) => {
  const { colors } = useTheme();
  return (
  <TouchableOpacity
    style={styles.sectionHeader}
    onPress={onToggle}
    disabled={!onToggle}
    activeOpacity={onToggle ? 0.7 : 1}
  >
    <View style={styles.sectionHeaderLeft}>
      <Icon name={icon} size={18} color={colors.accent} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
    <View style={styles.sectionHeaderRight}>
      {rightAction}
      {onToggle && (
        <Icon
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={20}
          color={colors.textSecondary}
        />
      )}
    </View>
  </TouchableOpacity>
);
};

// ===== Progress Bar =====
interface ProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
}

const _ProgressBar: React.FC<ProgressBarProps> = ({ progress, height = 8, showLabel = true }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.progressWrapper}>
      <View style={[styles.progressTrack, {backgroundColor: colors.background}, { height }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: progress >= 100 ? colors.success : colors.accent,
            }
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.progressLabel, {color: colors.accent}]}>{progress}%</Text>
      )}
    </View>
  );
};

// ===== Milestone Item =====
interface MilestoneItemProps {
  milestone: JobMilestone;
  onComplete: () => void;
  onSkip: () => void;
  isLast: boolean;
}

const _MilestoneItem: React.FC<MilestoneItemProps> = ({ milestone, onComplete, onSkip, isLast }) => {
  const { colors } = useTheme();
  const isCompleted = milestone.status === 'completed';
  const isSkipped = milestone.status === 'skipped';
  const isPending = milestone.status === 'pending';

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.milestoneItem}>
      <View style={styles.milestoneTimeline}>
        <View style={[
          styles.milestoneDot,
          isCompleted && styles.milestoneDotCompleted,
          isSkipped && styles.milestoneDotSkipped,
        ]}>
          {isCompleted && <Icon name="check" size={12} color={colors.textLight} />}
          {isSkipped && <Icon name="x" size={12} color={colors.textLight} />}
        </View>
        {!isLast && <View style={[
          styles.milestoneLine,
          isCompleted && styles.milestoneLineCompleted,
        ]} />}
      </View>
      <View style={styles.milestoneContent}>
        <View style={styles.milestoneHeader}>
          <Text style={[
            styles.milestoneTitle,
            (isCompleted || isSkipped) && styles.milestoneTitleDone,
          ]}>
            {milestone.title}
          </Text>
          {isCompleted && milestone.completedDate && (
            <Text style={[styles.milestoneDate, {color: colors.textSecondary}]}>{formatDate(milestone.completedDate)}</Text>
          )}
        </View>
        {milestone.description && (
          <Text style={[styles.milestoneDescription, {color: colors.textSecondary}]}>{milestone.description}</Text>
        )}
        {isPending && (
          <View style={styles.milestoneActions}>
            <TouchableOpacity style={styles.milestoneBtn} onPress={onComplete}>
              <Icon name="check" size={14} color={colors.success} />
              <Text style={[styles.milestoneBtnText, { color: colors.success }]}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.milestoneBtn} onPress={onSkip}>
              <Icon name="skip-forward" size={14} color={colors.textSecondary} />
              <Text style={[styles.milestoneBtnText, {color: colors.textSecondary}]}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

// ===== Line Item Row =====
interface LineItemRowProps {
  item: JobLineItem;
  showAllocation?: boolean;
}

const LineItemRow: React.FC<LineItemRowProps> = ({ item, showAllocation }) => {
  const { colors } = useTheme();
  const isLabor = item.type === 'labor';
  const total = isLabor
    ? (item.labor || 0) * (item.laborRate || 0)
    : (item.sellPrice || 0) * item.quantity; // Only sellPrice for customer total

  return (
    <View style={[styles.lineItemRow, {borderBottomColor: colors.divider}]}>
      <View style={styles.lineItemInfo}>
        {isLabor && (
          <View style={[styles.laborBadge, {backgroundColor: colors.accent}]}>
            <Icon name="clock" size={10} color={colors.textLight} />
          </View>
        )}
        <Text style={[styles.lineItemName, {color: colors.text}]} numberOfLines={2}>{item.description}</Text>
      </View>
      <View style={styles.lineItemDetails}>
        {isLabor ? (
          <Text style={[styles.lineItemQty, {color: colors.textSecondary}]}>{item.labor}h × ${item.laborRate}</Text>
        ) : (
          <Text style={[styles.lineItemQty, {color: colors.textSecondary}]}>{item.quantity} × ${item.sellPrice || 0}</Text>
        )}
        <Text style={[styles.lineItemTotal, {color: colors.text}]}>${total.toFixed(2)}</Text>
      </View>
    </View>
  );
};

// ===== Allocation Row =====
interface AllocationRowProps {
  allocation: InventoryAllocation;
  onMarkUsed: (qty: number) => void;
  onMarkReturned: (qty: number) => void;
}

const AllocationRow: React.FC<AllocationRowProps> = ({ allocation, onMarkUsed, onMarkReturned }) => {
  const { colors } = useTheme();
  const unitCost = allocation.unitCost ?? allocation.price ?? 0;
  const reservedQty = allocation.reservedQty ?? allocation.idealQuantity ?? 0;
  const usedQty = allocation.usedQty ?? 0;
  const returnedQty = allocation.returnedQty ?? 0;
  const remaining = reservedQty - usedQty - returnedQty;

  return (
    <View style={[styles.allocationRow, {borderBottomColor: colors.divider}]}>
      <View style={styles.allocationInfo}>
        <Text style={[styles.allocationTitle, {color: colors.text}]} numberOfLines={1}>{allocation.inventoryTitle || allocation.title || 'Material'}</Text>
        <View style={styles.allocationStatus}>
          <View style={[styles.allocationDot, { backgroundColor: getStatusDotColor(allocation.status || 'reserved', colors) }]} />
          <Text style={[styles.allocationStatusText, {color: colors.textSecondary}]}>{allocation.status || 'reserved'}</Text>
        </View>
      </View>
      <View style={styles.allocationQty}>
        <View style={styles.allocationQtyItem}>
          <Text style={[styles.allocationQtyLabel, {color: colors.textSecondary}]}>Reserved</Text>
          <Text style={[styles.allocationQtyValue, {color: colors.text}]}>{reservedQty}</Text>
        </View>
        <View style={styles.allocationQtyItem}>
          <Text style={[styles.allocationQtyLabel, {color: colors.textSecondary}]}>Used</Text>
          <Text style={[styles.allocationQtyValue, { color: colors.success }]}>{usedQty}</Text>
        </View>
        <View style={styles.allocationQtyItem}>
          <Text style={[styles.allocationQtyLabel, {color: colors.textSecondary}]}>Returned</Text>
          <Text style={[styles.allocationQtyValue, { color: colors.warning }]}>{returnedQty}</Text>
        </View>
      </View>
    </View>
  );};

const getStatusDotColor = (status: string, colors: any): string => {
  switch (status) {
    case 'reserved': return colors.warning;
    case 'loaded': return '#3B82F6';
    case 'used': return colors.success;
    case 'returned': return colors.textSecondary;
    default: return colors.textSecondary;
  }
};

// ===== Status Action Buttons =====
interface StatusActionsProps {
  status: JobStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onReopen: () => void;
}

const StatusActions: React.FC<StatusActionsProps> = ({
  status,
  onStart,
  onPause,
  onResume,
  onComplete,
  onCancel,
  onReopen,
}) => {
  const { colors } = useTheme();
  switch (status) {
    case 'draft':
      return null;
    case 'scheduled':
      return (
        <View style={styles.statusActions}>
          <TouchableOpacity style={[styles.statusBtn, styles.statusBtnPrimary, {backgroundColor: colors.accent}]} onPress={onStart}>
            <Icon name="play" size={18} color={colors.textLight} />
            <Text style={[styles.statusBtnTextPrimary, {color: colors.textLight}]}>Start Job</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onCancel}>
            <Icon name="x" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      );
    case 'in_progress':
      return (
        <View style={styles.statusActions}>
          <TouchableOpacity style={[styles.statusBtn, styles.statusBtnSuccess, {backgroundColor: colors.success}]} onPress={onComplete}>
            <Icon name="check-circle" size={18} color={colors.textLight} />
            <Text style={[styles.statusBtnTextPrimary, {color: colors.textLight}]}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPause}>
            <Icon name="pause" size={18} color={colors.warning} />
          </TouchableOpacity>
        </View>
      );
    case 'on_hold':
      return (
        <View style={styles.statusActions}>
          <TouchableOpacity style={[styles.statusBtn, styles.statusBtnPrimary, {backgroundColor: colors.accent}]} onPress={onResume}>
            <Icon name="play" size={18} color={colors.textLight} />
            <Text style={[styles.statusBtnTextPrimary, {color: colors.textLight}]}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onCancel}>
            <Icon name="x" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      );
    case 'completed':
    case 'cancelled':
      return (
        <View style={styles.statusActions}>
          <TouchableOpacity style={[styles.statusBtn, styles.statusBtnSecondary, {backgroundColor: `${colors.accent}15`, borderColor: colors.accent}]} onPress={onReopen}>
            <Icon name="rotate-ccw" size={18} color={colors.accent} />
            <Text style={[styles.statusBtnTextSecondary, {color: colors.accent}]}>Reopen Job</Text>
          </TouchableOpacity>
        </View>
      );
    default:
      return null;
  }
};

// ===== Main Screen =====
interface RouteParams {
  jobId: string;
}

export const JobDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { jobId } = route.params as RouteParams;

  const {
    currentJob,
    isLoading,
    loadJob,
    updateJobStatus,
    startJob,
    completeJob,
    cancelJob,
    completeMilestone,
    updateMilestone,
    addJobNote,
    updateJob,
    markInventoryUsed,
    markInventoryReturned,
    addMedia,
    removeMedia,
    initDraftForEdit,
    deleteJob,
    getChildJobs,
    getOccurrences,
    skipVisit,
    unskipVisit,
  } = useJob();

  const { hasPermission } = usePermissions();
  const { currentCompany } = useAuth();
  const canAssignTeam = hasPermission('jobs.assign_team');
  const canManageStatus = hasPermission('jobs.manage_status');
  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';

  const [sectionsCollapsed, setSectionsCollapsed] = useState({
    description: false,
    lineItems: false,
    inventory: true,
    goals: false,
    notes: true,
    financials: false,
  });
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assignedTeamMembers, setAssignedTeamMembers] = useState<AssignedTeamMember[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [childJobs, setChildJobs] = useState<JobListItem[]>([]);
  const [childJobsLoading, setChildJobsLoading] = useState(false);
  const [upcomingOccurrences, setUpcomingOccurrences] = useState<JobOccurrencesResponse | null>(null);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);
  const [showAllOccurrences, setShowAllOccurrences] = useState(false);

  // Square Payment state
  const [squareLinked, setSquareLinked] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  // Initial load
  useEffect(() => {
    loadJob(jobId);
  }, [jobId, loadJob]);

  // Load child jobs and upcoming occurrences for recurring parents
  useEffect(() => {
    if (currentJob?.isRecurring && currentJob?.id) {
      setChildJobsLoading(true);
      getChildJobs(currentJob.id)
        .then(setChildJobs)
        .catch(() => setChildJobs([]))
        .finally(() => setChildJobsLoading(false));

      setOccurrencesLoading(true);
      getOccurrences(currentJob.id, 10)
        .then(setUpcomingOccurrences)
        .catch(() => setUpcomingOccurrences(null))
        .finally(() => setOccurrencesLoading(false));
    }
  }, [currentJob?.isRecurring, currentJob?.id, getChildJobs, getOccurrences]);

  // Check Square connection status
  useEffect(() => {
    squarePaymentService.getStatus()
      .then(status => setSquareLinked(status.isLinked))
      .catch(() => setSquareLinked(false));
  }, []);

  // Reload team members when screen gains focus (after returning from assign screen)
  useFocusEffect(
    useCallback(() => {
      console.log('[JobDetail] Screen focused - reloading team assignments');
      jobAssignmentService.getJobAssignments(jobId)
        .then(members => {
          console.log('[JobDetail] Team assignments loaded:', members.length);
          setAssignedTeamMembers(members);
        })
        .catch(err => console.error('[JobDetail] Failed to load team assignments:', err));
      
      // Also reload the job to get updated assignments property
      loadJob(jobId);
    }, [jobId, loadJob])
  );

  const toggleSection = (section: keyof typeof sectionsCollapsed) => {
    setSectionsCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleViewClient = useCallback(() => {
    if (currentJob?.client?.id) {
      navigation.navigate('ClientProfile', { clientId: currentJob.client.id });
    }
  }, [currentJob, navigation]);

  // Handle edit (like EstimateDetailScreen)
  const handleEdit = useCallback(() => {
    if (currentJob) {
      console.log('[JobDetailScreen] handleEdit - currentJob before initDraftForEdit:', {
        id: currentJob.id,
        title: currentJob.title,
        jobInventoryLength: currentJob.jobInventory?.length,
        jobInventory: currentJob.jobInventory,
      });
      initDraftForEdit(currentJob);
      navigation.navigate('CreateJob', { editMode: true });
    }
  }, [currentJob, initDraftForEdit, navigation]);

  const handleStart = useCallback(() => {
    if (currentJob) {
      startJob(currentJob.id);
    }
  }, [currentJob, startJob]);

  const handlePause = useCallback(() => {
    if (currentJob) {
      updateJobStatus(currentJob.id, 'on_hold');
    }
  }, [currentJob, updateJobStatus]);

  const handleResume = useCallback(() => {
    if (currentJob) {
      updateJobStatus(currentJob.id, 'in_progress');
    }
  }, [currentJob, updateJobStatus]);

  const handleComplete = useCallback(() => {
    setShowCompleteModal(true);
  }, []);

  const confirmComplete = useCallback((updates: AllocationUpdate[]) => {
    if (currentJob) {
      // Update line items with used/returned quantities
      updates.forEach(update => {
        // Use inventoryId if available, otherwise skip inventory tracking for this item
        const inventoryId = update.inventoryId;
        if (inventoryId && update.usedQty > 0) {
          markInventoryUsed(currentJob.id, inventoryId, update.usedQty);
        }
        if (inventoryId && update.returnedQty > 0) {
          markInventoryReturned(currentJob.id, inventoryId, update.returnedQty);
        }
      });
      // Complete the job
      completeJob(currentJob.id);
      setShowCompleteModal(false);
    }
  }, [currentJob, completeJob, markInventoryUsed, markInventoryReturned]);

  const handleCancel = useCallback(() => {
    setShowCancelModal(true);
  }, []);

  const confirmCancel = useCallback(() => {
    if (currentJob) {
      cancelJob(currentJob.id);
      setShowCancelModal(false);
    }
  }, [currentJob, cancelJob]);

  const handleReopen = useCallback(() => {
    if (currentJob) {
      updateJobStatus(currentJob.id, 'scheduled');
    }
  }, [currentJob, updateJobStatus]);

  const _handleSchedule = useCallback(() => {
    if (currentJob) {
      updateJobStatus(currentJob.id, 'scheduled');
    }
  }, [currentJob, updateJobStatus]);

  // Check if job can be scheduled (has client and dates)
  const canScheduleJob = currentJob?.client && currentJob?.scheduledStartDate;


  // Handle delete job
  const handleDeleteJob = useCallback(async () => {
    if (!currentJob) return;
    setIsDeleting(true);
    try {
      await deleteJob(currentJob.id);
      setShowDeleteModal(false);
      navigation.goBack();
    } catch (error) {
      console.error('[JobDetailScreen] Delete error:', error);
      Alert.alert('Error', 'Failed to delete job. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [currentJob, deleteJob, navigation]);

  const _handleCompleteMilestone = useCallback((milestoneId: string) => {
    if (currentJob) {
      completeMilestone(currentJob.id, milestoneId);
    }
  }, [currentJob, completeMilestone]);

  const _handleSkipMilestone = useCallback((milestoneId: string) => {
    if (currentJob) {
      updateMilestone(currentJob.id, milestoneId, { status: 'skipped' });
    }
  }, [currentJob, updateMilestone]);

  const handleAddNote = useCallback(() => {
    if (currentJob && newNote.trim()) {
      addJobNote(currentJob.id, { content: newNote.trim(), type: 'text' });
      setNewNote('');
      setShowNoteModal(false);
    }
  }, [currentJob, newNote, addJobNote]);

  const { colors, isDark } = useTheme();

  // Dynamic styles based on theme

  // Computed values
  const statusColor = currentJob ? getJobStatusColor(currentJob.status) : colors.textSecondary;
  const statusLabel = currentJob ? getJobStatusLabel(currentJob.status) : '';

  const _formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
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

  if (isLoading || !currentJob) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Job Details" onBack={handleGoBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title={currentJob.title}
        onBack={handleGoBack}
        titleComponent={
          <View style={styles.headerTitleWrap}>
            <InlineEditableTitle
              value={currentJob.title}
              onSave={(newTitle) => updateJob(currentJob.id, { title: newTitle })}
              placeholder="Untitled Job"
              fontSize={18}
            />
          </View>
        }
        tag={
          <View style={[styles.headerStatusTag, { backgroundColor: `${statusColor}15` }]}>
            <View style={[styles.headerStatusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.headerStatusTagText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        }
        rightAction={
          <TouchableOpacity
            onPress={handleEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="edit-2" size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView         style={[styles.scrollView, {backgroundColor: colors.background}]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Time Tracking - Clock In/Out for this job */}
        {currentJob.status === 'in_progress' && (
          <View style={{ marginBottom: 16 }}>
            <ClockInOutWidget
              jobId={currentJob.id}
              jobName={currentJob.title}
              compact={true}
            />
          </View>
        )}

        {/* ===== MEGA SECTION 1: Job Info + Client + Schedule ===== */}
        <View style={[styles.megaSection, { backgroundColor: colors.surface }]}>
          {/* 1. Job Information */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionLabelRow}>
              <Icon name="briefcase" size={15} color={colors.accent} />
              <Text style={[styles.sectionLabel, {color: colors.text}]}>Details</Text>
            </View>
            {currentJob.description ? (
              <View style={[styles.descriptionContainer, {marginTop: theme.spacing.sm}]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Description</Text>
                <Text style={[styles.descriptionText, { color: colors.text }]}>
                  {currentJob.description}
                </Text>
              </View>
            ) : null}

            {/* Draft mode helper text */}
            {currentJob.status === 'draft' && !canScheduleJob && (
              <View style={[styles.draftHelperContainer, {backgroundColor: colors.surface, marginTop: theme.spacing.sm}]}>
                <Icon name="info" size={16} color={colors.textSecondary} />
                <Text style={[styles.draftHelperText, { color: colors.textSecondary }]}>
                  Add a client and schedule dates to enable scheduling
                </Text>
              </View>
            )}

            {canManageStatus && (
              <View style={{marginTop: theme.spacing.sm}}>
                <StatusActions
                  status={currentJob.status}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onComplete={handleComplete}
                  onCancel={handleCancel}
                  onReopen={handleReopen}
                />
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider }]} />

          {/* 2. Client & Location */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionLabelRow}>
              <Icon name="users" size={15} color={colors.accent} />
              <Text style={[styles.sectionLabel, {color: colors.text}]}>Client & Location</Text>
            </View>
            <View style={{gap: theme.spacing.sm, marginTop: theme.spacing.sm}}>
              <TouchableOpacity
                style={[styles.selectorRow, {borderColor: currentJob.client ? colors.accent : colors.border, backgroundColor: currentJob.client ? `${colors.accent}06` : colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
                onPress={currentJob.client ? handleViewClient : handleEdit}
                activeOpacity={0.7}
              >
                <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                  <Icon name="user" size={16} color={colors.accent} />
                </View>
                <View style={styles.selectorContent}>
                 
                  <Text style={[styles.selectorValue, {color: currentJob.client ? colors.text : colors.textSecondary}]} numberOfLines={1}>
                    {currentJob.client?.contactName || 'No client assigned'}
                  </Text>
                  {currentJob.client?.email && (
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>{currentJob.client.email}</Text>
                  )}
                  {currentJob.client?.phone && (
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>{currentJob.client.phone}</Text>
                  )}
                  {!currentJob.client && (
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.accent, marginTop: 1}}>Tap to add client</Text>
                  )}
                </View>
                <Icon name="chevron-right" size={18} color={currentJob.client ? colors.textSecondary : colors.accent} />
              </TouchableOpacity>
              {currentJob.location ? (
                <>
                <TouchableOpacity
                  style={[styles.selectorRow, {borderColor: colors.accent, backgroundColor: `${colors.accent}06`, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
                  onPress={() => {
                    setMapExpanded(!mapExpanded);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="map-pin" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    
                    <Text style={[styles.selectorValue, {color: colors.text}]} numberOfLines={1}>
                      {currentJob.location.addressLine1}
                    </Text>
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>
                      {currentJob.location.city}, {currentJob.location.state} {currentJob.location.zipcode}
                    </Text>
                  </View>
                  <Icon 
                    name={mapExpanded ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
                
                {mapExpanded && (() => {
                  console.log('[JobDetail] Rendering map section - mapExpanded:', mapExpanded);
                  console.log('[JobDetail] Platform:', Platform.OS);
                  
                  if (!currentJob.location?.latitude || !currentJob.location?.longitude) {
                    console.warn('[JobDetail] ⚠️ Missing coordinates');
                    return (
                      <View style={[styles.mapContainer, {backgroundColor: colors.surface}]}>
                        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }]}>
                          <Icon name="alert-circle" size={40} color={colors.textSecondary} />
                          <Text style={{ marginTop: 8, color: colors.textSecondary }}>No coordinates available</Text>
                        </View>
                      </View>
                    );
                  }
                  
                  const lat = currentJob.location.latitude;
                  const lng = currentJob.location.longitude;
                  const address = currentJob.location.addressLine1 || '';
                  const cityState = `${currentJob.location.city}, ${currentJob.location.state}`;
                  
                  console.log('[JobDetail] ✅ Coordinates:', { lat, lng });
                  
                  const handleOpenInMaps = () => {
                    const url = Platform.select({
                      ios: `maps:?q=${lat},${lng}`,
                      android: `geo:${lat},${lng}?q=${lat},${lng}(${address})`,
                    });
                    console.log('[JobDetail] Opening maps with URL:', url);
                    Linking.openURL(url!).catch((err) => {
                      console.error('[JobDetail] Error opening maps:', err);
                      Alert.alert('Error', 'Could not open maps');
                    });
                  };
                  
                  return (
                    <View style={styles.mapSection}>
                      <View style={[styles.mapContainer, {backgroundColor: colors.surface}]}>
                        <MapView
                          key={`map-${lat}-${lng}`}
                          style={styles.map}
                          initialRegion={{
                            latitude: lat,
                            longitude: lng,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          }}
                          region={{
                            latitude: lat,
                            longitude: lng,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                          }}
                          scrollEnabled={true}
                          zoomEnabled={true}
                          showsUserLocation={false}
                          showsMyLocationButton={false}
                          onMapReady={() => console.log('[JobDetail] ✅ MapView ready')}
                          loadingEnabled={true}
                          loadingIndicatorColor={colors.accent}
                          loadingBackgroundColor="#ffffff"
                        >
                          <Marker
                            coordinate={{ latitude: lat, longitude: lng }}
                            title={address}
                            description={cityState}
                          />
                        </MapView>
                      </View>
                      <TouchableOpacity 
                        style={[styles.openMapsButton, {backgroundColor: `${colors.accent}15`}]}
                        onPress={handleOpenInMaps}
                        activeOpacity={0.7}
                      >
                        <Icon name="external-link" size={16} color={colors.accent} />
                        <Text style={[styles.openMapsButtonText, {color: colors.accent}]}>Open in Maps</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.selectorRow, {borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
                  onPress={handleEdit}
                  activeOpacity={0.7}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="map-pin" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Location</Text>
                    <Text style={[styles.selectorValue, {color: colors.textSecondary}]}>No location assigned</Text>
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.accent, marginTop: 1}}>Tap to add location</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider }]} />

          {/* 3. Schedule */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionLabelRow}>
              <Icon name="calendar" size={15} color={colors.accent} />
              <Text style={[styles.sectionLabel, {color: colors.text}]}>Schedule</Text>
            </View>
            {(currentJob.actualStartDate || currentJob.scheduledStartDate) ? (
              <View style={[styles.dateRow, {marginTop: theme.spacing.sm}]}>
                <View style={styles.dateField}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Start Date</Text>
                  <View style={[
                    styles.dateDisplay,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}>
                    <View style={[
                      styles.dateIconContainer,
                      { backgroundColor: colors.accent },
                    ]}>
                      <Icon name="calendar" size={14} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.dateText, { color: colors.text }, styles.dateTextFilled]}>
                      {new Date(currentJob.actualStartDate || currentJob.scheduledStartDate!).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.dateField}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>End Date</Text>
                  <View style={[
                    styles.dateDisplay,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}>
                    <View style={[
                      styles.dateIconContainer,
                      { backgroundColor: (currentJob.actualEndDate || currentJob.scheduledEndDate) ? colors.accent : `${colors.accent}15` },
                    ]}>
                      <Icon name="calendar" size={14} color={(currentJob.actualEndDate || currentJob.scheduledEndDate) ? '#FFFFFF' : colors.accent} />
                    </View>
                    <Text style={[styles.dateText, { color: (currentJob.actualEndDate || currentJob.scheduledEndDate) ? colors.text : colors.textSecondary }, (currentJob.actualEndDate || currentJob.scheduledEndDate) && styles.dateTextFilled]}>
                      {(currentJob.actualEndDate || currentJob.scheduledEndDate)
                        ? new Date(currentJob.actualEndDate || currentJob.scheduledEndDate!).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true
                        })
                        : 'Not set'
                      }
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dateRow, {marginTop: theme.spacing.sm}]}
                onPress={handleEdit}
                activeOpacity={0.7}
              >
                <View style={{flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md}}>
                  <Icon name="calendar" size={24} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary, paddingVertical: 4 }]}>Not scheduled</Text>
                  <Text style={[styles.clientDetailText, { color: colors.accent }]}>Tap to set schedule</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Parent Job Banner - for auto-created child jobs */}
            {currentJob.parentJobId && currentJob.parentJobTitle && (
              <>
                <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider, marginTop: theme.spacing.sm }]} />
                <TouchableOpacity
                  style={{flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, gap: theme.spacing.sm, backgroundColor: `${colors.warning}08`, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.sm, marginTop: theme.spacing.xs}}
                  onPress={() => navigation.navigate('JobDetail', { jobId: currentJob.parentJobId! })}
                  activeOpacity={0.7}
                >
                  <View style={{width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.warning}15`, alignItems: 'center', justifyContent: 'center'}}>
                    <Icon name="git-branch" size={14} color={colors.warning} />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary}}>Auto-created from recurring job</Text>
                    <Text style={{fontSize: theme.fontSize.sm, fontWeight: '600' as const, color: colors.text, marginTop: 1}}>{currentJob.parentJobTitle}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Skip / Unskip Visit button for child jobs */}
                {currentJob.status !== 'completed' && currentJob.status !== 'cancelled' && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 10,
                      marginTop: theme.spacing.xs,
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: currentJob.status === 'skipped' ? `${colors.success}10` : `${colors.textSecondary}10`,
                    }}
                    onPress={async () => {
                      try {
                        if (currentJob.status === 'skipped') {
                          await unskipVisit(currentJob.id);
                        } else {
                          await skipVisit(currentJob.id);
                        }
                      } catch (e: any) {
                        console.warn('Skip/Unskip failed:', e.message);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={currentJob.status === 'skipped' ? 'rotate-ccw' : 'skip-forward'}
                      size={14}
                      color={currentJob.status === 'skipped' ? colors.success : colors.textSecondary}
                    />
                    <Text style={{
                      fontSize: theme.fontSize.sm,
                      fontWeight: '600' as const,
                      color: currentJob.status === 'skipped' ? colors.success : colors.textSecondary,
                    }}>
                      {currentJob.status === 'skipped' ? 'Unskip Visit' : 'Skip Visit'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Recurring Job - Full Section */}
            {currentJob.isRecurring && currentJob.recurrenceRule && (() => {
              const { summary, detail } = parseRRuleToHuman(currentJob.recurrenceRule);
              const displayOccurrences = upcomingOccurrences?.occurrences ?? [];
              const visibleOccurrences = showAllOccurrences ? displayOccurrences : displayOccurrences.slice(0, 4);
              return (
                <>
                  <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider, marginTop: theme.spacing.sm }]} />

                  {/* ── Header row ── */}
                  <View style={{flexDirection: 'row', alignItems: 'center', paddingTop: theme.spacing.sm, gap: theme.spacing.sm}}>
                    <View style={{width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.accent}15`, alignItems: 'center', justifyContent: 'center'}}>
                      <Icon name="repeat" size={15} color={colors.accent} />
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={{fontSize: theme.fontSize.sm, fontWeight: '700' as const, color: colors.text, letterSpacing: 0.1}}>
                        {summary}
                      </Text>
                      <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>
                        {detail}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={handleEdit} style={{padding: 6}} activeOpacity={0.7}>
                      <Icon name="edit-2" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* ── Billing Frequency - temporarily hidden (not yet integrated with payments)
                  {currentJob.billingFrequency && (
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.spacing.sm, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: `${colors.accent}08`}}>
                      <Icon name="dollar-sign" size={12} color={colors.accent} />
                      <Text style={{fontSize: theme.fontSize.xs, color: colors.text}}>
                        Billing: <Text style={{fontWeight: '600' as const}}>
                          {currentJob.billingFrequency === 'per_visit' ? 'Per Visit' :
                           currentJob.billingFrequency === 'monthly' ? 'Monthly' :
                           currentJob.billingFrequency === 'on_completion' ? 'On Completion' :
                           currentJob.billingFrequency === 'custom' ? 'Custom' :
                           currentJob.billingFrequency}
                        </Text>
                      </Text>
                    </View>
                  )}
                  ── */}

                  {/* ── Upcoming Occurrences ── */}
                  <View style={{marginTop: theme.spacing.md}}>
                    <Text style={{fontSize: theme.fontSize.xs, fontWeight: '600' as const, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: theme.spacing.sm}}>
                      Upcoming Dates
                    </Text>

                    {occurrencesLoading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : displayOccurrences.length > 0 ? (
                      <>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                          {visibleOccurrences.map((occ, idx) => {
                            const d = new Date(occ);
                            const isFirst = idx === 0;
                            const isPast = d < new Date();
                            return (
                              <View
                                key={occ}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 10,
                                  backgroundColor: isPast
                                    ? `${colors.divider}`
                                    : isFirst
                                    ? `${colors.accent}18`
                                    : `${colors.accent}09`,
                                  borderWidth: isFirst && !isPast ? 1 : 0,
                                  borderColor: `${colors.accent}40`,
                                  alignItems: 'center',
                                }}
                              >
                                <Text style={{fontSize: 11, fontWeight: '700' as const, color: isPast ? colors.textSecondary : colors.accent}}>
                                  {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Text>
                                <Text style={{fontSize: 10, color: isPast ? colors.textSecondary : colors.textSecondary, marginTop: 1}}>
                                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                        {displayOccurrences.length > 4 && (
                          <TouchableOpacity
                            onPress={() => setShowAllOccurrences(v => !v)}
                            style={{flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: theme.spacing.sm}}
                            activeOpacity={0.7}
                          >
                            <Text style={{fontSize: theme.fontSize.xs, color: colors.accent, fontWeight: '600' as const}}>
                              {showAllOccurrences ? 'Show less' : `Show all ${displayOccurrences.length} dates`}
                            </Text>
                            <Icon name={showAllOccurrences ? 'chevron-up' : 'chevron-down'} size={12} color={colors.accent} />
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, fontStyle: 'italic'}}>
                        No upcoming dates found
                      </Text>
                    )}
                  </View>

                  {/* ── Auto-Created Jobs ── */}
                  <View style={{marginTop: theme.spacing.md}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm}}>
                      <Text style={{fontSize: theme.fontSize.xs, fontWeight: '600' as const, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7}}>
                        Auto-Created Jobs
                      </Text>
                      {childJobs.length > 0 && (
                        <View style={{paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: `${colors.accent}15`}}>
                          <Text style={{fontSize: 11, fontWeight: '700' as const, color: colors.accent}}>{childJobs.length}</Text>
                        </View>
                      )}
                    </View>

                    {childJobsLoading ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : childJobs.length > 0 ? (
                      <>
                        {childJobs.slice(0, 5).map((child, idx) => {
                          const childStatusColor = getJobStatusColor(child.status);
                          const isLast = idx === Math.min(childJobs.length, 5) - 1;
                          return (
                            <TouchableOpacity
                              key={child.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 10,
                                gap: theme.spacing.sm,
                                borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                                borderBottomColor: colors.divider,
                              }}
                              onPress={() => navigation.push('JobDetail', { jobId: child.id })}
                              activeOpacity={0.7}
                            >
                              <View style={{width: 36, height: 36, borderRadius: 10, backgroundColor: `${childStatusColor}12`, alignItems: 'center', justifyContent: 'center'}}>
                                <Icon name="briefcase" size={14} color={childStatusColor} />
                              </View>
                              <View style={{flex: 1}}>
                                <Text style={{fontSize: theme.fontSize.sm, fontWeight: '600' as const, color: colors.text}} numberOfLines={1}>
                                  {child.title || child.jobNumber}
                                </Text>
                                <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>
                                  {child.scheduledStartDate
                                    ? new Date(child.scheduledStartDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                    : 'No date'}
                                  {child.jobNumber ? ` · ${child.jobNumber}` : ''}
                                </Text>
                              </View>
                              <View style={{paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${childStatusColor}15`}}>
                                <Text style={{fontSize: 10, fontWeight: '700' as const, color: childStatusColor, textTransform: 'uppercase', letterSpacing: 0.3}}>
                                  {getJobStatusLabel(child.status)}
                                </Text>
                              </View>
                              <Icon name="chevron-right" size={14} color={colors.textSecondary} />
                            </TouchableOpacity>
                          );
                        })}
                        {childJobs.length > 5 && (
                          <Text style={{fontSize: theme.fontSize.xs, color: colors.accent, fontWeight: '600' as const, textAlign: 'center', marginTop: theme.spacing.xs}}>
                            +{childJobs.length - 5} more
                          </Text>
                        )}
                      </>
                    ) : (
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, backgroundColor: `${colors.accent}06`, borderRadius: 10}}>
                        <Icon name="clock" size={14} color={colors.textSecondary} />
                        <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, flex: 1}}>
                          Jobs are auto-created 1 week before each occurrence
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
        {/* ===== END MEGA SECTION 1 ===== */}

        {/* ===== MEGA SECTION 2: Line Items + Gallery ===== */}
        <View style={[styles.megaSection, { backgroundColor: colors.surface }]}>
          {/* Line Items */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Line Items</Text>
              <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
                {currentJob.lineItems?.length || 0} items
              </Text>
            </View>
            {(currentJob.lineItems || []).length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: theme.spacing.sm }]}>No line items yet.</Text>
            ) : (
              <View style={{ marginTop: theme.spacing.sm }}>
                {(currentJob.lineItems || []).map(item => (
                  <LineItemRow key={item.id} item={item} />
                ))}
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider }]} />

          {/* Gallery - Before/After */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <JobGallery
              jobId={currentJob.id}
              media={(currentJob.media || []) as any}
              readOnly={false}
              onAddMedia={(media) => addMedia(media)}
              onRemoveMedia={(mediaId) => removeMedia(mediaId)}
            />
          </View>
        </View>
        {/* ===== END MEGA SECTION 2 ===== */}

        {/* ===== MEGA SECTION 3: Financials + Payments ===== */}
        <View style={[styles.megaSection, { backgroundColor: colors.surface }]}>
          {/* Financials */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Icon name="dollar-sign" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Financials</Text>
              </View>
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Materials Cost</Text>
                <Text style={[styles.financialValue, { color: colors.text }]}>{formatCurrency(currentJob.materialsCost || 0)}</Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Labor Cost</Text>
                <Text style={[styles.financialValue, { color: colors.text }]}>{formatCurrency(currentJob.laborCost || 0)}</Text>
              </View>
              <View style={[styles.financialDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Total Cost</Text>
                <Text style={[styles.financialValue, { color: colors.text }]}>
                  {formatCurrency((currentJob.materialsCost || 0) + (currentJob.laborCost || 0))}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabelBold, { color: colors.text }]}>Estimated Total</Text>
                <Text style={[styles.financialValueBold, { color: colors.text }]}>{formatCurrency(currentJob.estimatedTotal || 0)}</Text>
              </View>
              {currentJob.profit !== undefined && (
                <View style={styles.financialRow}>
                  <Text style={[styles.financialLabel, { color: (currentJob.profit || 0) >= 0 ? colors.success : colors.error }]}>
                    Profit/Loss
                  </Text>
                  <Text style={[styles.financialValue, { color: (currentJob.profit || 0) >= 0 ? colors.success : colors.error }]}>
                    {(currentJob.profit || 0) >= 0 ? '+' : ''}{formatCurrency(currentJob.profit || 0)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider }]} />

          {/* Payments */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Icon name="credit-card" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Payments</Text>
              </View>
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <CollectPaymentButton
                jobId={currentJob.id}
                jobTitle={currentJob.title}
                estimatedTotal={currentJob.estimatedTotal || 0}
                squareLinked={squareLinked}
                onPaymentComplete={(payment) => {
                  setSelectedPayment(payment);
                  setShowPaymentModal(true);
                }}
                onPaymentLinkCreated={() => {
                  setPaymentRefreshKey(prev => prev + 1);
                }}
              />
              <PaymentHistorySection
                jobId={currentJob.id}
                refreshKey={paymentRefreshKey}
                onPaymentPress={(payment) => {
                  setSelectedPayment(payment);
                  setShowPaymentModal(true);
                }}
              />
            </View>
          </View>
        </View>
        {/* ===== END MEGA SECTION 3 ===== */}

        {/* Payment Confirmation Modal */}
        <PaymentConfirmationModal
          visible={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPayment(null);
          }}
          payment={selectedPayment}
          jobTitle={currentJob.title}
        />

        {/* ===== MEGA SECTION 4: Team + Goals ===== */}
        <View style={[styles.megaSection, { backgroundColor: colors.surface }]}>
          {/* Team Assignment */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Icon name="users" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Team ({assignedTeamMembers.length})</Text>
              </View>
              {canAssignTeam && (
                <TouchableOpacity onPress={() => navigation.navigate('AssignTeamMembers', { jobId: currentJob.id, jobTitle: currentJob.title })}>
                  <Icon name="user-plus" size={18} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
            {assignedTeamMembers.length === 0 ? (
              <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No team members assigned yet.</Text>
            ) : (
              <View style={styles.teamMembersGrid}>
                {assignedTeamMembers.map(member => (
                  <View key={member.userId} style={[styles.teamMemberItem, {backgroundColor: colors.surface}]}>
                    {member.photoThumbnail ? (
                      <Image
                        source={{ uri: member.photoThumbnail }}
                        style={styles.teamMemberAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.teamMemberAvatarPlaceholder, {backgroundColor: colors.accent}]}>
                        <Text style={[styles.teamMemberInitials, {color: colors.textLight}]}>
                          {member.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.teamMemberName, {color: colors.text}]} numberOfLines={1}>{member.fullName}</Text>
                    <Text style={[styles.teamMemberRole, {color: colors.textSecondary}]}>{member.role}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.megaSectionDivider, { backgroundColor: colors.divider }]} />

          {/* Goals */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <GoalSection
              jobId={currentJob.id}
              collapsed={sectionsCollapsed.goals}
              onToggle={() => toggleSection('goals')}
              readOnly={false}
            />
          </View>
        </View>
        {/* ===== END MEGA SECTION 4 ===== */}

        {/* Notes Section - Read Only in view mode */}
        <View style={styles.section}>
          <SectionHeader
            title={`Notes (${currentJob.notes?.length || 0})`}
            icon="message-square"
            collapsed={sectionsCollapsed.notes}
            onToggle={() => toggleSection('notes')}
          />
          {!sectionsCollapsed.notes && (
            <View style={[styles.sectionContent, {backgroundColor: colors.surface}]}>
              {(currentJob.notes?.length || 0) === 0 ? (
                <Text style={[styles.emptyNotesText, {color: colors.textSecondary}]}>No notes yet.</Text>
              ) : (
                (currentJob.notes || []).map(note => (
                  <View key={note.id} style={[styles.noteItem, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <Text style={[styles.noteContent, {color: colors.text}]}>{note.content}</Text>
                    <Text style={[styles.noteDate, {color: colors.textSecondary}]}>
                      {new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Source Estimate */}
        {currentJob.estimateId && (
          <View style={styles.section}>
            <SectionHeader
              title="Source Estimate"
              icon="file-text"
            />
            <TouchableOpacity
              style={[styles.sourceEstimateCard, {backgroundColor: colors.surface}]}
              onPress={() => navigation.navigate('EstimateDetail', { estimateId: currentJob.estimateId! })}
            >
              <View style={styles.sourceEstimateInfo}>
                <View style={styles.sourceEstimateTextContainer}>
                  <Text style={[styles.sourceEstimateNumber, {color: colors.text}]} numberOfLines={2}>{currentJob.estimateTitle || currentJob.estimateNumber || 'View Estimate'}</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Job Button - Admin only */}
        {isAdmin && (
          <TouchableOpacity             style={[styles.deleteButton, {backgroundColor: `${colors.error}10`}, {borderColor: colors.border}]}
            onPress={() => setShowDeleteModal(true)}
          >
            <Icon name="trash-2" size={18} color={colors.error} />
            <Text style={[styles.deleteButtonText, {color: colors.error}]}>Delete Job</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Job?"
        message="This action cannot be undone. All job data will be permanently deleted."
        icon="trash-2"
        iconColor={colors.error}
        buttons={[
          { text: 'Cancel', onPress: () => setShowDeleteModal(false), style: 'cancel' },
          { text: isDeleting ? 'Deleting...' : 'Delete', onPress: handleDeleteJob },
        ]}
      />

      {/* Add Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNoteModal(false)}
        >
          <View style={[styles.noteModalContent, {backgroundColor: colors.surface}]}>
            <Text style={[styles.noteModalTitle, {color: colors.text}]}>Add Note</Text>
            <TextInput
              style={[styles.noteInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
              placeholder="Enter your note..."
              placeholderTextColor={colors.textSecondary}
              value={newNote}
              onChangeText={setNewNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.noteModalActions}>
              <TouchableOpacity                 style={[styles.noteModalBtn, {backgroundColor: colors.accent}, {borderColor: colors.border}]}
                onPress={() => setShowNoteModal(false)}
              >
                <Text style={[styles.noteModalBtnText, {color: colors.textSecondary}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteModalBtn, styles.noteModalBtnPrimary, {backgroundColor: colors.accent}]}
                onPress={handleAddNote}
              >
                <Text style={[styles.noteModalBtnTextPrimary, {color: colors.textLight}]}>Add Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        visible={showCancelModal}
        title="Cancel Job?"
        message="Are you sure you want to cancel this job? This action cannot be undone."
        icon="alert-triangle"
        iconColor={colors.error}
        buttons={[
          { text: 'No, Keep It', onPress: () => setShowCancelModal(false), style: 'cancel' },
          { text: 'Yes, Cancel', onPress: confirmCancel },
        ]}
      />

      {/* Job Completion Modal with Inventory Tracking */}
      <JobCompletionModal
        visible={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={confirmComplete}
        lineItems={currentJob.lineItems || []}
        jobTitle={currentJob.title}
      />
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
  loadingText: {
    fontSize: theme.fontSize.md,

  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },

  // Header Title
  headerTitleWrap: {
    flex: 1,
  },
  headerJobNumber: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },

  // Header Badge
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    gap: 4,
  },
  headerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerStatusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  headerStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    gap: 4,
  },
  headerStatusTagText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },

  // Mega Section - groups related sections
  megaSection: {

    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  megaSectionInner: {
    padding: theme.spacing.md,
  },
  megaSectionDivider: {
    height: 1,

    marginHorizontal: theme.spacing.md,
  },

  // Section - matches EstimateDetail
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionInMega: {
    marginBottom: 0,
    paddingVertical: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.sm,
  },
  itemCount: {
    fontSize: theme.fontSize.sm,

  },
  card: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },

  // Detail Row - matches EstimateDetail
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  detailValue: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,

    marginVertical: theme.spacing.md,
  },

  // Description - matches EstimateDetail
  descriptionContainer: {
    gap: theme.spacing.xs,
  },
  descriptionText: {
    fontSize: theme.fontSize.md,

    lineHeight: 22,
  },

  // Status Badge Inline
  statusBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,

  },
  statusDotInline: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTextInline: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },

  // Client & Location Selector Rows (matching Create screens)
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  selectorContent: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: theme.fontSize.xs,
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
  },
  clientRowExpanded: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  clientIconLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  clientInfoExpanded: {
    flex: 1,
  },
  clientNameLarge: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginBottom: 2,
  },
  clientDetailText: {
    fontSize: theme.fontSize.sm,

  },
  mapSection: {
    marginTop: theme.spacing.md,
  },
  mapContainer: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    height: 250,

  },
  map: {
    width: '100%',
    height: '100%',
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  openMapsButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },

  emptyText: {
    fontSize: theme.fontSize.sm,

    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },

  // Status Actions
  statusActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,

    gap: theme.spacing.xs,
  },
  statusBtnPrimary: {
    flex: 1,

  },
  statusBtnSuccess: {
    flex: 1,

  },
  statusBtnSecondary: {
    flex: 1,

    borderWidth: 1,

  },
  statusBtnTextPrimary: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  statusBtnTextSecondary: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  statusBtnDisabled: {

    opacity: 0.6,
  },
  statusBtnTextDisabled: {
  },
  placeholderText: {
    fontSize: theme.fontSize.md,

    fontStyle: 'italic',
  },
  draftHelperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  draftHelperText: {
    fontSize: theme.fontSize.sm,

    flex: 1,
  },

  // SectionHeader component styles (used by old Description section)
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },

  // Progress
  progressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressTrack: {
    flex: 1,

    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

    width: 50,
    textAlign: 'right',
  },
  progressSubtext: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },

  // Milestones
  milestoneItem: {
    flexDirection: 'row',
  },
  milestoneTimeline: {
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  milestoneDot: {
    width: 24,
    height: 24,
    borderRadius: 12,

    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDotCompleted: {
  },
  milestoneDotSkipped: {
  },
  milestoneLine: {
    width: 2,
    flex: 1,

    marginVertical: 4,
  },
  milestoneLineCompleted: {
  },
  milestoneContent: {
    flex: 1,
    paddingBottom: theme.spacing.md,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  milestoneTitleDone: {

    textDecorationLine: 'line-through',
  },
  milestoneDate: {
    fontSize: theme.fontSize.xs,

  },
  milestoneDescription: {
    fontSize: theme.fontSize.sm,

    marginTop: 2,
  },
  milestoneActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  milestoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  milestoneBtnText: {
    fontSize: theme.fontSize.sm,

  },

  // Financials
  financialsCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  financialLabel: {
    fontSize: theme.fontSize.sm,

  },
  financialLabelBold: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  financialValue: {
    fontSize: theme.fontSize.md,

  },
  financialValueBold: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  financialDivider: {
    height: 1,

    marginVertical: theme.spacing.sm,
  },

  // Line Items
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  lineItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.xs,
  },
  laborBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemName: {
    fontSize: theme.fontSize.sm,

    flex: 1,
  },
  lineItemDetails: {
    alignItems: 'flex-end',
  },
  lineItemQty: {
    fontSize: theme.fontSize.xs,

  },
  lineItemTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },

  // Allocations
  allocationRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  allocationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  allocationTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    flex: 1,
  },
  allocationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  allocationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  allocationStatusText: {
    fontSize: theme.fontSize.xs,

    textTransform: 'capitalize',
  },
  allocationQty: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  allocationQtyItem: {
    alignItems: 'center',
  },
  allocationQtyLabel: {
    fontSize: 10,

  },
  allocationQtyValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },

  // Team Assignment
  teamAssignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  teamAssignmentInfo: {
    flex: 1,
  },
  teamAssignmentTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginBottom: 2,
  },
  teamAssignmentSubtitle: {
    fontSize: theme.fontSize.sm,

  },

  // Notes
  addNoteBtn: {
    padding: 4,
  },
  emptyNotesText: {
    fontSize: theme.fontSize.sm,

    fontStyle: 'italic',
  },
  noteItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  noteContent: {
    fontSize: theme.fontSize.sm,

  },
  noteDate: {
    fontSize: theme.fontSize.xs,

    marginTop: 4,
  },

  // Source Estimate
  sourceEstimateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  sourceEstimateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  sourceEstimateTextContainer: {
    flex: 1,
  },
  sourceEstimateLabel: {
    fontSize: theme.fontSize.xs,

  },
  sourceEstimateNumber: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },

  // Note Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteModalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '90%',
    maxWidth: 400,
  },
  noteModalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.md,
  },
  noteInput: {

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,

    minHeight: 100,
    marginBottom: theme.spacing.md,
  },
  noteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  noteModalBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  noteModalBtnPrimary: {
  },
  noteModalBtnText: {
    fontSize: theme.fontSize.md,

  },
  noteModalBtnTextPrimary: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  titleSection: {
    marginBottom: theme.spacing.md,
  },

  // Schedule Section - matches EstimateDetail
  sectionSubtitle: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.md,
    marginTop: -theme.spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  dateField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    gap: theme.spacing.sm,
  },
  dateDisplayEmpty: {

    borderStyle: 'dashed',

  },
  dateIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',
  },
  dateIconContainerFilled: {
  },
  dateText: {
    flex: 1,
    fontSize: theme.fontSize.sm,

  },
  dateTextFilled: {

    fontWeight: theme.fontWeight.medium,
  },

  // Team Members Grid
  teamMembersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  teamMemberItem: {
    alignItems: 'center',
    width: 70,
  },
  teamMemberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,

  },
  teamMemberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,

    justifyContent: 'center',
    alignItems: 'center',
  },
  teamMemberInitials: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  teamMemberName: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,

    marginTop: 4,
    textAlign: 'center',
  },
  teamMemberRole: {
    fontSize: 10,

    textAlign: 'center',
  },
  // Delete button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

  },
  deleteButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
});

export default JobDetailScreen;
