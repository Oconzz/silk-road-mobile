import React, {useCallback, useEffect, useState, useMemo} from 'react';
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
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {useNavigation, useRoute} from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {useClient} from '../context/ClientContext';
import {useJob} from '../context/JobContext';
import {useEstimate} from '../context/EstimateContext';
import {useAuth} from '../context/AuthContext';
import {ScreenHeader, ConfirmationModal} from '../components/ui';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import type {JobListItem, EstimateListItem} from '../types/apiResponses';
import {getJobStatusColor, getJobStatusLabel} from '../types/job';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// ===== Quick Action Pill =====
interface ActionPillProps {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  bgColor: string;
}

const ActionPill: React.FC<ActionPillProps> = ({icon, label, color, onPress, bgColor}) => (
  <TouchableOpacity style={[styles.actionPill, {backgroundColor: bgColor}]} onPress={onPress} activeOpacity={0.7}>
    <Icon name={icon} size={18} color={color} />
    <Text style={[styles.actionPillLabel, {color}]}>{label}</Text>
  </TouchableOpacity>
);

// ===== Stat Card Component =====
interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({label, value, icon, color: colorProp}) => {
  const {colors} = useTheme();
  const color = colorProp || colors.accent;
  return (
    <View style={[styles.statCard, {backgroundColor: colors.surface, borderColor: `${color}20`}]}>
      <View style={[styles.statIconWrap, {backgroundColor: `${color}12`}]}>
        <Icon name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, {color: colors.text}]}>{value}</Text>
      <Text style={[styles.statLabel, {color: colors.textSecondary}]}>{label}</Text>
    </View>
  );
};

// ===== Job Row Card =====
interface JobRowCardProps {
  job: JobListItem;
  onPress: () => void;
}

const JobRowCard: React.FC<JobRowCardProps> = ({job, onPress}) => {
  const {colors} = useTheme();
  const statusColor = getJobStatusColor(job.status);
  
  return (
    <TouchableOpacity style={[styles.rowCard, {backgroundColor: colors.surface}]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowCardAccent, {backgroundColor: statusColor}]} />
      <View style={styles.rowCardBody}>
        <View style={styles.rowCardTop}>
          <Text style={[styles.rowCardNumber, {color: colors.textSecondary}]}>{job.jobNumber}</Text>
          <View style={[styles.rowStatusBadge, {backgroundColor: `${statusColor}15`}]}>
            <View style={[styles.rowStatusDot, {backgroundColor: statusColor}]} />
            <Text style={[styles.rowStatusText, {color: statusColor}]}>
              {getJobStatusLabel(job.status)}
            </Text>
          </View>
        </View>
        <Text style={[styles.rowCardTitle, {color: colors.text}]} numberOfLines={1}>{job.title}</Text>
        <View style={styles.rowCardBottom}>
          <View style={styles.rowCardDateWrap}>
            <Icon name="calendar" size={11} color={colors.textSecondary} />
            <Text style={[styles.rowCardDate, {color: colors.textSecondary}]}>
              {new Date(job.createDatetime).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
            </Text>
          </View>
          <Text style={[styles.rowCardTotal, {color: colors.accent}]}>${(job.estimatedTotal || 0).toLocaleString()}</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

// ===== Estimate Row Card =====
interface EstimateRowCardProps {
  estimate: EstimateListItem;
  onPress: () => void;
}

const EstimateRowCard: React.FC<EstimateRowCardProps> = ({estimate, onPress}) => {
  const {colors} = useTheme();
  const getStatusColor = () => {
    if (estimate.approved) return colors.success;
    if (estimate.sent) return colors.warning;
    return colors.textSecondary;
  };
  
  const getStatusText = () => {
    if (estimate.approved) return 'Approved';
    if (estimate.sent) return 'Sent';
    return 'Draft';
  };

  const statusColor = getStatusColor();
  
  return (
    <TouchableOpacity style={[styles.rowCard, {backgroundColor: colors.surface}]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowCardAccent, {backgroundColor: statusColor}]} />
      <View style={styles.rowCardBody}>
        <View style={styles.rowCardTop}>
          <Text style={[styles.rowCardNumber, {color: colors.textSecondary}]}>{estimate.estimateNumber || 'EST-...'}</Text>
          <View style={[styles.rowStatusBadge, {backgroundColor: `${statusColor}15`}]}>
            <View style={[styles.rowStatusDot, {backgroundColor: statusColor}]} />
            <Text style={[styles.rowStatusText, {color: statusColor}]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
        <Text style={[styles.rowCardTitle, {color: colors.text}]} numberOfLines={1}>{estimate.name}</Text>
        <View style={styles.rowCardBottom}>
          <View style={styles.rowCardDateWrap}>
            <Icon name="calendar" size={11} color={colors.textSecondary} />
            <Text style={[styles.rowCardDate, {color: colors.textSecondary}]}>
              {new Date(estimate.createDatetime).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
            </Text>
          </View>
          <Text style={[styles.rowCardTotal, {color: colors.accent}]}>${estimate.total.toLocaleString()}</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

// ===== Note Item =====
interface NoteItemProps {
  content: string;
  date: string;
  onEdit: () => void;
  onDelete: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({content, date, onEdit, onDelete}) => {
  const {colors} = useTheme();
  return (
    <View style={[styles.noteItem, {backgroundColor: colors.surface, borderLeftColor: colors.accent}]}>
      <Text style={[styles.noteContent, {color: colors.text}]}>{content}</Text>
      <View style={styles.noteFooter}>
        <View style={styles.noteDateWrap}>
          <Icon name="clock" size={11} color={colors.textSecondary} />
          <Text style={[styles.noteDate, {color: colors.textSecondary}]}>{date}</Text>
        </View>
        <View style={styles.noteActions}>
          <TouchableOpacity style={[styles.noteActionBtn, {backgroundColor: colors.background}]} onPress={onEdit} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Icon name="edit-2" size={13} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.noteActionBtn, {backgroundColor: `${colors.error}08`}]} onPress={onDelete} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Icon name="trash-2" size={13} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ===== Section Header =====
interface SectionHeaderProps {
  title: string;
  icon: string;
  count?: number;
  action?: {
    label: string;
    icon?: string;
    onPress: () => void;
  };
}

const SectionHeader: React.FC<SectionHeaderProps> = ({title, icon, count, action}) => {
  const {colors} = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionIconWrap, {backgroundColor: `${colors.accent}10`}]}>
          <Icon name={icon} size={14} color={colors.accent} />
        </View>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>{title}</Text>
        {count !== undefined && (
          <View style={[styles.countBadge, {backgroundColor: `${colors.accent}15`}]}>
            <Text style={[styles.countText, {color: colors.accent}]}>{count}</Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity style={[styles.sectionActionBtn, {backgroundColor: `${colors.accent}10`}]} onPress={action.onPress}>
          {action.icon && <Icon name={action.icon} size={13} color={colors.accent} />}
          <Text style={[styles.sectionAction, {color: colors.accent}]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ===== Main Screen =====
interface RouteParams {
  clientId: string;
}

export const ClientProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const {clientId} = route.params as RouteParams;

  const {
    clientProfile,
    isLoading,
    loadClientProfile,
    addClientNote,
    removeClientNote,
    jobs,
  } = useJob();

  const {estimates, clients} = useEstimate();
  const {deleteClient, locations, loadClientLocations} = useClient();
  const {currentCompany} = useAuth();

  // Check if user is Admin
  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';

  // Get jobs for this client
  const clientJobs = jobs.filter(j => j.clientId === clientId);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'jobs' | 'estimates'>('jobs');

  // Delete client state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Normalize clientProfile with default values for missing fields
  const normalizedProfile = useMemo(() => clientProfile ? {
    ...clientProfile,
    jobs: clientProfile.jobs || [],
    notes: clientProfile.notes || [],
    totalSpent: clientProfile.totalSpent ?? 0,
    totalJobs: clientProfile.totalJobs ?? 0,
    averageJobValue: clientProfile.averageJobValue ?? 0,
    completedJobs: clientProfile.completedJobs ?? 0,
    totalEstimates: clientProfile.totalEstimates ?? 0,
    approvalRate: clientProfile.approvalRate ?? 0,
  } : null, [clientProfile]);

  // Find the client from the clients list to pass to loadClientProfile
  const clientFromList = clients.find(c => c.id === clientId);

  useEffect(() => {
    console.log('[ClientProfileScreen] Loading profile for clientId:', clientId, 'clientFromList:', !!clientFromList);
    loadClientProfile(clientId);
    loadClientLocations(clientId);
  }, [clientId, loadClientProfile, loadClientLocations]);

  // Get estimates for this client by clientId
  const clientEstimates = estimates.filter(e => e.clientId === clientId);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle delete client
  const handleDeleteClient = useCallback(async () => {
    if (!clientId) return;
    setIsDeleting(true);
    try {
      await deleteClient(clientId);
      setShowDeleteModal(false);
      navigation.goBack();
    } catch (error) {
      console.error('[ClientProfileScreen] Delete error:', error);
      Alert.alert('Error', 'Failed to delete client. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteClient, clientId, navigation]);

  const handleCall = useCallback(() => {
    if (normalizedProfile?.phone) {
      Linking.openURL(`tel:${normalizedProfile.phone}`);
    }
  }, [normalizedProfile]);

  const handleEmail = useCallback(() => {
    if (normalizedProfile?.email) {
      Linking.openURL(`mailto:${normalizedProfile.email}`);
    }
  }, [normalizedProfile]);

  const handleViewLocations = useCallback(() => {
    if (normalizedProfile) {
      console.log('[ClientProfile] View locations for client:', normalizedProfile.id);
      navigation.navigate('SelectLocation', {
        clientId: normalizedProfile.id,
        mode: 'manage',
      });
    }
  }, [normalizedProfile, navigation]);

  const handleAddNote = useCallback(() => {
    if (newNote.trim() && normalizedProfile) {
      addClientNote(normalizedProfile.id, newNote.trim());
      setNewNote('');
      setShowNoteModal(false);
    }
  }, [newNote, normalizedProfile, addClientNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
    if (normalizedProfile) {
      removeClientNote(normalizedProfile.id, noteId);
    }
  }, [normalizedProfile, removeClientNote]);

  const handleOpenJob = useCallback((jobId: string) => {
    navigation.navigate('JobDetail', {jobId});
  }, [navigation]);

  const handleOpenEstimate = useCallback((estimateId: string) => {
    navigation.navigate('EstimateDetail', {estimateId});
  }, [navigation]);

  const handleCreateJob = useCallback(() => {
    if (normalizedProfile) {
      navigation.navigate('CreateJob', {clientId: normalizedProfile.id});
    }
  }, [navigation, normalizedProfile]);

  const handleCreateEstimate = useCallback(() => {
    navigation.navigate('CreateEstimate');
  }, [navigation]);

  // Navigate to Edit Client screen
  const handleOpenEdit = useCallback(() => {
    if (normalizedProfile) {
      navigation.navigate('EditClient', {clientId: normalizedProfile.id});
    }
  }, [normalizedProfile, navigation]);

  const formatCurrency = (amount?: number) => {
    const value = amount ?? 0;
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const { colors, isDark } = useTheme();

  if (isLoading || !normalizedProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Client Profile" onBack={handleGoBack} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading client...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <ScreenHeader
        title="Client Profile"
        onBack={handleGoBack}
        rightAction={
          <TouchableOpacity
            style={[styles.editButton, {backgroundColor: `${colors.accent}12`}]}
            onPress={handleOpenEdit}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="edit-2" size={16} color={colors.accent} />
          </TouchableOpacity>
        }
      />

      <ScrollView 
        style={[styles.scrollView, {backgroundColor: colors.background}]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header Card */}
        <View style={[styles.headerCard, {backgroundColor: colors.surface}]}>
          {/* Centered Avatar + Name */}
          <View style={styles.heroSection}>
            <View style={[styles.avatarWrap, {backgroundColor: colors.accent}]}>
              <Text style={[styles.avatarText, {color: colors.textLight}]}>
                {normalizedProfile.contactName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.clientName, {color: colors.text}]}>{normalizedProfile.contactName}</Text>
            {normalizedProfile.companyName && (
              <Text style={[styles.companyName, {color: colors.textSecondary}]}>{normalizedProfile.companyName}</Text>
            )}
          </View>

          {/* Contact Chips */}
          <View style={styles.contactChips}>
            {normalizedProfile.phone && (
              <TouchableOpacity style={[styles.contactChip, {backgroundColor: colors.background}]} onPress={handleCall}>
                <Icon name="phone" size={13} color={colors.accent} />
                <Text style={[styles.contactChipText, {color: colors.text}]}>{normalizedProfile.phone}</Text>
              </TouchableOpacity>
            )}
            {normalizedProfile.email && (
              <TouchableOpacity style={[styles.contactChip, {backgroundColor: colors.background}]} onPress={handleEmail}>
                <Icon name="mail" size={13} color={colors.accent} />
                <Text style={[styles.contactChipText, {color: colors.text}]} numberOfLines={1}>{normalizedProfile.email}</Text>
              </TouchableOpacity>
            )}
            {normalizedProfile.location && (
              <View style={[styles.contactChip, {backgroundColor: colors.background}]}>
                <Icon name="map-pin" size={13} color={colors.accent} />
                <Text style={[styles.contactChipText, {color: colors.text}]} numberOfLines={1}>
                  {normalizedProfile.location.city}, {normalizedProfile.location.state}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Actions Row */}
          <View style={[styles.actionsRow, {borderTopColor: colors.border}]}>
            <ActionPill icon="phone" label="Call" color={colors.accent} bgColor={`${colors.accent}10`} onPress={handleCall} />
            <ActionPill icon="mail" label="Email" color={colors.accent} bgColor={`${colors.accent}10`} onPress={handleEmail} />
            {locations && locations.length > 0 && (
              <ActionPill icon="map-pin" label="Location" color={colors.warning} bgColor={`${colors.warning}10`} onPress={handleViewLocations} />
            )}
            <ActionPill icon="tool" label="New Job" color={colors.success} bgColor={`${colors.success}10`} onPress={handleCreateJob} />
            <ActionPill icon="file-text" label="Estimate" color={colors.info || colors.accent} bgColor={`${(colors.info || colors.accent)}10`} onPress={handleCreateEstimate} />
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard 
            label="Revenue" 
            value={formatCurrency(normalizedProfile.totalSpent)}
            icon="dollar-sign"
            color={colors.success}
          />
          <StatCard 
            label="Jobs" 
            value={clientJobs.length}
            icon="briefcase"
            color={colors.accent}
          />
          <StatCard 
            label="Avg. Cost" 
            value={formatCurrency(normalizedProfile.averageJobValue * 0.7)}
            icon="trending-down"
            color={colors.warning}
          />
          <StatCard 
            label="Avg. Profit" 
            value={formatCurrency(normalizedProfile.averageJobValue * 0.3)}
            icon="trending-up"
            color={colors.success}
          />
        </View>

        {/* Pill Tab Switcher */}
        <View style={[styles.tabContainer, {backgroundColor: colors.background}]}>
          <TouchableOpacity 
            style={[styles.tab, {backgroundColor: activeTab === 'jobs' ? colors.accent : colors.surface}]}
            onPress={() => setActiveTab('jobs')}
            activeOpacity={0.7}
          >
            <Icon name="briefcase" size={14} color={activeTab === 'jobs' ? colors.textLight : colors.textSecondary} />
            <Text style={[styles.tabText, {color: activeTab === 'jobs' ? colors.textLight : colors.textSecondary}]}>
              Jobs ({clientJobs.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, {backgroundColor: activeTab === 'estimates' ? colors.accent : colors.surface}]}
            onPress={() => setActiveTab('estimates')}
            activeOpacity={0.7}
          >
            <Icon name="file-text" size={14} color={activeTab === 'estimates' ? colors.textLight : colors.textSecondary} />
            <Text style={[styles.tabText, {color: activeTab === 'estimates' ? colors.textLight : colors.textSecondary}]}>
              Estimates ({clientEstimates.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Jobs/Estimates List */}
        <View style={styles.section}>
          {activeTab === 'jobs' ? (
            clientJobs.length > 0 ? (
              <View style={styles.cardsList}>
                {clientJobs.map((job) => (
                  <JobRowCard 
                    key={job.id} 
                    job={job} 
                    onPress={() => handleOpenJob(job.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, {backgroundColor: colors.surface}]}>
                <View style={[styles.emptyIconWrap, {backgroundColor: `${colors.accent}10`}]}>
                  <Icon name="briefcase" size={24} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, {color: colors.text}]}>No jobs yet</Text>
                <Text style={[styles.emptyText, {color: colors.textSecondary}]}>Create a job for this client to get started</Text>
                <TouchableOpacity style={[styles.emptyActionBtn, {backgroundColor: colors.accent}]} onPress={handleCreateJob}>
                  <Icon name="plus" size={14} color={colors.textLight} />
                  <Text style={[styles.emptyActionText, {color: colors.textLight}]}>Create Job</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            clientEstimates.length > 0 ? (
              <View style={styles.cardsList}>
                {clientEstimates.map(estimate => (
                  <EstimateRowCard 
                    key={estimate.id} 
                    estimate={estimate} 
                    onPress={() => handleOpenEstimate(estimate.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, {backgroundColor: colors.surface}]}>
                <View style={[styles.emptyIconWrap, {backgroundColor: `${colors.accent}10`}]}>
                  <Icon name="file-text" size={24} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, {color: colors.text}]}>No estimates yet</Text>
                <Text style={[styles.emptyText, {color: colors.textSecondary}]}>Create an estimate for this client</Text>
                <TouchableOpacity style={[styles.emptyActionBtn, {backgroundColor: colors.accent}]} onPress={handleCreateEstimate}>
                  <Icon name="plus" size={14} color={colors.textLight} />
                  <Text style={[styles.emptyActionText, {color: colors.textLight}]}>Create Estimate</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <SectionHeader 
            title="Notes" 
            icon="message-square"
            count={normalizedProfile.notes.length}
            action={{
              label: 'Add Note',
              icon: 'plus',
              onPress: () => setShowNoteModal(true),
            }}
          />
          {normalizedProfile.notes.length > 0 ? (
            <View style={styles.notesList}>
              {normalizedProfile.notes.map((note: any) => (
                <NoteItem
                  key={note.id}
                  content={note.content}
                  date={new Date(note.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  onEdit={() => {}}
                  onDelete={() => handleDeleteNote(note.id)}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyNotes, {backgroundColor: colors.surface}]}>
              <Icon name="message-square" size={20} color={colors.textSecondary} />
              <Text style={[styles.emptyNotesText, {color: colors.textSecondary}]}>No notes yet</Text>
            </View>
          )}
        </View>

        {/* Client Since Footer */}
        <View style={[styles.clientSince, {borderTopColor: colors.border}]}>
          <Icon name="clock" size={13} color={colors.textSecondary} />
          <Text style={[styles.clientSinceText, {color: colors.textSecondary}]}>
            Client since {new Date(normalizedProfile.createDatetime).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Delete Client Button - Admin only */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.deleteButton, {borderColor: `${colors.error}30`}]}
            onPress={() => setShowDeleteModal(true)}
          >
            <Icon name="trash-2" size={16} color={colors.error} />
            <Text style={[styles.deleteButtonText, {color: colors.error}]}>Delete Client</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Client?"
        message="This action cannot be undone. All client data will be permanently deleted."
        icon="trash-2"
        iconColor={colors.error}
        buttons={[
          { text: 'Cancel', onPress: () => setShowDeleteModal(false), style: 'cancel' },
          { text: isDeleting ? 'Deleting...' : 'Delete', onPress: handleDeleteClient },
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
              placeholder="Enter a note about this client..."
              placeholderTextColor={colors.textSecondary}
              value={newNote}
              onChangeText={setNewNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.noteModalActions}>
              <TouchableOpacity
                style={[styles.noteModalBtn, {backgroundColor: colors.surface}]}
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

  // Hero Header Card
  headerCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.md,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: theme.fontWeight.bold,
  },
  clientName: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 2,
  },
  companyName: {
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },

  // Contact Chips
  contactChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    maxWidth: SCREEN_WIDTH * 0.7,
  },
  contactChipText: {
    fontSize: theme.fontSize.xs,
    flexShrink: 1,
  },

  // Action Pills
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
  },
  actionPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 56,
  },
  actionPillLabel: {
    fontSize: 10,
    fontWeight: theme.fontWeight.medium,
    marginTop: 3,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  statLabel: {
    fontSize: 10,
    marginTop: 1,
  },

  // Pill Tabs
  tabContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    ...theme.shadow.sm,
  },
  tabText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },

  // Section
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  sectionAction: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },

  // Row Cards (Jobs/Estimates)
  cardsList: {
    gap: theme.spacing.sm,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  rowCardAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  rowCardBody: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  rowCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  rowCardNumber: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rowStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  rowStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  rowStatusText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
  },
  rowCardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  rowCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCardDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowCardDate: {
    fontSize: 11,
  },
  rowCardTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
  },
  emptyActionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },

  // Notes
  notesList: {
    gap: theme.spacing.sm,
  },
  noteItem: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
  },
  noteContent: {
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  noteDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteDate: {
    fontSize: 11,
  },
  noteActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  noteActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  emptyNotesText: {
    fontSize: theme.fontSize.sm,
  },

  // Client Since
  clientSince: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
  },
  clientSinceText: {
    fontSize: theme.fontSize.xs,
  },

  // Note Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteModalContent: {
    borderRadius: theme.borderRadius.xl,
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
    borderRadius: theme.borderRadius.full,
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

  // Edit Button (header)
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Delete button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
});

export default ClientProfileScreen;
