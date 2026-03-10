import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Clipboard,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import MapView, { Marker } from 'react-native-maps';
import Config from 'react-native-config';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useEstimate } from '../context/EstimateContext';
import { useJob } from '../context/JobContext';
import { ScreenHeader, ConfirmationModal, InlineEditableTitle, CalendarPicker } from '../components/ui';
import { EstimateGallery } from '../components/EstimateGallery';
import { shareViaSMS, shareViaEmail, shareEstimateAsPDF } from '../services/pdfService';
import { estimateService } from '../services/api/domain/estimates/estimateService';
import { jobService } from '../services/api/domain/jobs/jobService';
import type { EstimateDetailScreenProps } from '../types/navigation';
import type { EstimateListItem, JobRM } from '../types/apiResponses';
import { haptics } from '../utils/haptics';

export const EstimateDetailScreen: React.FC<EstimateDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { estimateId } = route.params;
  const {
    currentEstimate,
    isLoading,
    loadEstimate,
    deleteEstimate,
    updateEstimate,
    initDraft,
    initDraftForEdit,
    saveAsTemplate,
    generateShareLink,
  } = useEstimate();

  const { convertEstimateToJob, updateJob } = useJob();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showOverallocationModal, setShowOverallocationModal] = useState(false);
  const [overallocationData, setOverallocationData] = useState<any>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showProposedDatePicker, setShowProposedDatePicker] = useState(false);
  const [showExpirationDatePicker, setShowExpirationDatePicker] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isSmsLoading, setIsSmsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isLinkLoading, setIsLinkLoading] = useState(false);
  const [versionHistory, setVersionHistory] = useState<EstimateListItem[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [linkedJob, setLinkedJob] = useState<JobRM | null>(null);
  const [showUpdateJobModal, setShowUpdateJobModal] = useState(false);

  // Load estimate on mount
  useEffect(() => {
    loadEstimate(estimateId);
  }, [loadEstimate, estimateId]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Load version history
  const loadVersionHistory = useCallback(async () => {
    if (!currentEstimate) return;
    setIsLoadingVersions(true);
    try {
      const rootId = currentEstimate.parentEstimateId || currentEstimate.id;
      const history = await estimateService.getVersionHistory(rootId);
      setVersionHistory(history);
    } catch (error) {
      console.error('Error loading version history:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  }, [currentEstimate]);

  // Create new version from this estimate
  const handleCreateVersion = useCallback(async () => {
    if (!currentEstimate || isCreatingVersion) return;
    setIsCreatingVersion(true);
    try {
      const newVersion = await estimateService.createVersion(currentEstimate.id);
      haptics.success();
      // Navigate to the new version
      navigation.replace('EstimateDetail', { estimateId: newVersion.id });
    } catch (error) {
      console.error('Error creating version:', error);
      Alert.alert('Error', 'Failed to create new version');
    } finally {
      setIsCreatingVersion(false);
    }
  }, [currentEstimate, isCreatingVersion, navigation]);

  // Toggle version history panel
  const handleToggleVersionHistory = useCallback(() => {
    if (!showVersionHistory && versionHistory.length === 0) {
      loadVersionHistory();
    }
    setShowVersionHistory(prev => !prev);
  }, [showVersionHistory, versionHistory.length, loadVersionHistory]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const { colors, isDark } = useTheme();

  // Dynamic styles based on theme

  // Get status
  const getStatus = () => {
    if (currentEstimate?.approved) { return { text: 'Approved', color: colors.success }; }
    if (currentEstimate?.sent) { return { text: 'Sent', color: colors.warning }; }
    return { text: 'Draft', color: colors.textSecondary };
  };

  // Handle delete
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteEstimate(estimateId);
      setShowDeleteModal(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting estimate:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteEstimate, estimateId, navigation]);

  // Actual conversion logic (create new job)
  const doConvert = useCallback(async () => {
    if (!currentEstimate) return;
    setIsConverting(true);
    setShowOverallocationModal(false);
    try {
      await convertEstimateToJob(currentEstimate.id, currentEstimate);
      await updateEstimate(estimateId, { approved: true, id: estimateId });

      haptics.success();
      // Navigate directly to Jobs tab (no confirmation modal)
      navigation.reset({
        index: 0,
        routes: [{
          name: 'MainTabs',
          state: {
            routes: [{ name: 'HomeTab' }, { name: 'InventoryTab' }, { name: 'JobsTab' }],
            index: 2,
          },
        }],
      });
    } catch (error: any) {
      console.error('Error converting to job:', error);
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Free plan limit') || errorMessage.includes('FREEMIUM_LIMIT')) {
        Alert.alert(
          'Upgrade Required',
          'You\'ve reached your free plan limit for jobs. Subscribe to unlock unlimited access.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'View Plans', onPress: () => navigation.navigate('PlanSelection' as any) },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage || 'Failed to convert estimate to job');
      }
    } finally {
      setIsConverting(false);
    }
  }, [currentEstimate, convertEstimateToJob, updateEstimate, estimateId, navigation]);

  // Check overallocation before converting
  const handleCheckAndConvert = useCallback(async () => {
    if (!currentEstimate) return;
    setShowConvertModal(false);
    setIsConverting(true);
    try {
      // Check if a job already exists for this estimate's version family
      const linkedResult = await jobService.getJobByEstimateId(currentEstimate.id);
      if (linkedResult.found && linkedResult.job) {
        setLinkedJob(linkedResult.job);
        setIsConverting(false);
        setShowUpdateJobModal(true);
        return;
      }
    } catch {
      console.log('[EstimateDetail] No linked job found, proceeding with new conversion');
    }
    try {
      // Check for inventory conflicts
      const result = await estimateService.checkOverallocation(currentEstimate.id);
      if (result.hasConflicts) {
        setOverallocationData(result);
        setShowOverallocationModal(true);
        setIsConverting(false);
        return;
      }
      // No conflicts - proceed with conversion
      await doConvert();
    } catch (error: any) {
      console.error('Error checking overallocation:', error);
      // If check fails, still allow conversion
      await doConvert();
    }
  }, [currentEstimate, doConvert]);

  // Update existing job from new estimate version
  const doUpdateExistingJob = useCallback(async () => {
    if (!currentEstimate || !linkedJob) return;
    setShowUpdateJobModal(false);
    setIsConverting(true);
    try {
      const lineItems = currentEstimate.items || (currentEstimate as any).lineItems || [];
      const materialsCost = lineItems
        .filter((item: any) => item.type !== 'labor')
        .reduce((sum: number, item: any) => sum + ((item.price || item.cost || 0) * (item.quantity || 1)), 0);
      const laborCost = lineItems
        .reduce((sum: number, item: any) => sum + ((item.labor || 0) * (item.quantity || 1)), 0);
      const estimatedTotal = currentEstimate.totalCost || currentEstimate.total || (materialsCost + laborCost);

      const jobInventory = lineItems.map((item: any) => ({
        productId: item.productId || item.id,
        warehouseId: item.warehouseId,
        inventoryId: item.inventoryId,
        idealQuantity: item.quantity || 1,
        actualQuantity: 0,
        price: item.sellPrice || item.price || item.cost || 0,
        labor: item.labor || 0,
        title: item.title || item.description || '',
        description: item.description || '',
      }));

      await updateJob(linkedJob.id, {
        id: linkedJob.id,
        title: currentEstimate.name || linkedJob.title,
        description: currentEstimate.description || linkedJob.description,
        estimateId: currentEstimate.id,
        estimatedTotal,
        laborCost,
        materialsCost,
        jobInventory,
        scheduledStartDate: currentEstimate.proposedStartDate || linkedJob.scheduledStartDate,
        scheduledEndDate: currentEstimate.expirationDate || linkedJob.scheduledEndDate,
      });

      await updateEstimate(estimateId, { approved: true, id: estimateId });
      haptics.success();
      // Navigate directly to the updated job detail (no confirmation modal)
      navigation.replace('JobDetail', { jobId: linkedJob.id });
    } catch (error: any) {
      console.error('Error updating existing job:', error);
      Alert.alert('Error', error?.message || 'Failed to update job');
    } finally {
      setIsConverting(false);
    }
  }, [currentEstimate, linkedJob, updateJob, updateEstimate, estimateId, navigation]);

  // Handle duplicate
  const handleDuplicate = useCallback(() => {
    if (currentEstimate) {
      initDraft(currentEstimate);
      navigation.navigate('CreateEstimate');
    }
  }, [currentEstimate, initDraft, navigation]);

  // Handle edit (preserves original estimate ID)
  const handleEdit = useCallback(() => {
    if (currentEstimate) {
      initDraftForEdit(currentEstimate); // Use edit mode - preserves ID
      navigation.navigate('CreateEstimate');
    }
  }, [currentEstimate, initDraftForEdit, navigation]);

  // Handle save as template
  const handleSaveAsTemplate = useCallback(() => {
    if (!currentEstimate) { return; }
    setIsSavingTemplate(true);
    saveAsTemplate(currentEstimate.id, `${currentEstimate.name} Template`);
    setShowSaveTemplateModal(false);
    setIsSavingTemplate(false);
    haptics.success();
    // Navigate directly to templates list (no confirmation modal)
    navigation.navigate('TemplatesList' as any);
  }, [currentEstimate, saveAsTemplate, navigation]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!currentEstimate || isShareLoading) { return; }
    setIsShareLoading(true);
    try {
      await shareEstimateAsPDF(currentEstimate as any);
    } catch (error) {
      console.error('Error sharing estimate:', error);
      Alert.alert('Error', 'Failed to share estimate');
    } finally {
      setIsShareLoading(false);
    }
  }, [currentEstimate, isShareLoading]);

  // Handle share via SMS
  const handleShareSMS = useCallback(async () => {
    if (!currentEstimate || isSmsLoading) { return; }
    setIsSmsLoading(true);
    try {
      let estimateWithLink = currentEstimate as any;
      if (!estimateWithLink.publicShareUrl && !estimateWithLink.publicShareId) {
        try {
          estimateWithLink = await generateShareLink(currentEstimate.id);
        } catch {
          // proceed without link — fallback text will be used
        }
      }
      await shareViaSMS(estimateWithLink, currentEstimate.client?.phone);
    } catch (error) {
      console.error('Error sharing via SMS:', error);
      Alert.alert('Error', 'SMS not available on this device');
    } finally {
      setIsSmsLoading(false);
    }
  }, [currentEstimate, isSmsLoading, generateShareLink]);

  // Handle share via Email
  const handleShareEmail = useCallback(async () => {
    if (!currentEstimate || isEmailLoading) { return; }
    setIsEmailLoading(true);
    try {
      let estimateWithLink = currentEstimate as any;
      if (!estimateWithLink.publicShareUrl && !estimateWithLink.publicShareId) {
        try {
          estimateWithLink = await generateShareLink(currentEstimate.id);
        } catch {
          // proceed without link — fallback text will be used
        }
      }
      await shareViaEmail(estimateWithLink, currentEstimate.client?.email);
    } catch (error) {
      console.error('Error sharing via Email:', error);
      Alert.alert('Error', 'Email not available on this device');
    } finally {
      setIsEmailLoading(false);
    }
  }, [currentEstimate, isEmailLoading, generateShareLink]);

  // Handle copy share link to clipboard
  const handleShareAsLink = useCallback(async () => {
    if (!currentEstimate || isLinkLoading) { return; }
    setIsLinkLoading(true);
    try {
      console.log('[EstimateDetail] Generating public share link...');
      const updatedEstimate = await generateShareLink(currentEstimate.id);
      const sharePath = updatedEstimate.publicShareUrl;
      if (sharePath) {
        // Build full URL from API base URL + relative path
        const apiUrl = Config.API_URL || 'http://127.0.0.1:5001';
        const fullUrl = `${apiUrl}${sharePath}`;
        console.log('[EstimateDetail] Copying share URL to clipboard:', fullUrl);
        Clipboard.setString(fullUrl);
        Alert.alert(
          'Link Copied!',
          'The estimate link has been copied to your clipboard. Share it with your client.',
          [
            { text: 'OK' },
            { text: 'Open Link', onPress: () => Linking.openURL(fullUrl) },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to generate share link');
      }
    } catch (error) {
      console.error('Error generating share link:', error);
      Alert.alert('Error', 'Failed to generate share link');
    } finally {
      setIsLinkLoading(false);
    }
  }, [currentEstimate, isLinkLoading, generateShareLink]);


  if (isLoading && !currentEstimate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Estimate" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentEstimate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Estimate" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Icon name="alert-circle" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Estimate not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = getStatus();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title={currentEstimate.name || 'Estimate'}
        onBack={() => navigation.goBack()}
        titleComponent={
          <View style={styles.headerTitleWrap}>
            <InlineEditableTitle
              value={currentEstimate.name}
              onSave={(newName) => updateEstimate(estimateId, { name: newName })}
              placeholder="Untitled Estimate"
              fontSize={theme.fontSize.lg}
            />
            {currentEstimate.estimateNumber && (
              <Text style={[styles.headerEstimateNumber, {color: colors.textSecondary}]}>{currentEstimate.estimateNumber}</Text>
            )}
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

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Approval Status Banner */}
        {currentEstimate.approved && (
          <View style={[styles.approvalBanner, { backgroundColor: `${colors.success}12` }]}>
            <View style={[styles.approvalBannerIcon, { backgroundColor: `${colors.success}20` }]}>
              <Icon name="check-circle" size={20} color={colors.success} />
            </View>
            <View style={styles.approvalBannerContent}>
              <Text style={[styles.approvalBannerTitle, { color: colors.success }]}>Approved</Text>
              <Text style={[styles.approvalBannerSubtitle, { color: colors.textSecondary }]}>
                Client approved this estimate
              </Text>
            </View>
          </View>
        )}

        {currentEstimate.sent && !currentEstimate.approved && (
          <View style={[styles.approvalBanner, { backgroundColor: `${colors.warning}12` }]}>
            <View style={[styles.approvalBannerIcon, { backgroundColor: `${colors.warning}20` }]}>
              <Icon name="send" size={20} color={colors.warning} />
            </View>
            <View style={styles.approvalBannerContent}>
              <Text style={[styles.approvalBannerTitle, { color: colors.warning }]}>Sent</Text>
              <Text style={[styles.approvalBannerSubtitle, { color: colors.textSecondary }]}>
                Waiting for client approval
                {currentEstimate.sentDateTime && ` • Sent ${formatDate(currentEstimate.sentDateTime)}`}
              </Text>
            </View>
          </View>
        )}

        {/* Version Info Section */}
        {(currentEstimate.version && currentEstimate.version > 1 || currentEstimate.parentEstimateId) && (
          <View style={[styles.versionSection, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.versionHeader}
              onPress={handleToggleVersionHistory}
              activeOpacity={0.7}
            >
              <View style={styles.versionBadgeRow}>
                <View style={[styles.versionBadge, { backgroundColor: `${colors.accent}15` }]}>
                  <Icon name="git-branch" size={14} color={colors.accent} />
                  <Text style={[styles.versionBadgeText, { color: colors.accent }]}>
                    v{currentEstimate.version || 1}
                  </Text>
                </View>
                {currentEstimate.isLatestVersion && (
                  <View style={[styles.latestBadge, { backgroundColor: `${colors.success}15` }]}>
                    <Text style={[styles.latestBadgeText, { color: colors.success }]}>Latest</Text>
                  </View>
                )}
              </View>
              <Icon
                name={showVersionHistory ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showVersionHistory && (
              <View style={styles.versionHistoryPanel}>
                {isLoadingVersions ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ paddingVertical: 12 }} />
                ) : versionHistory.length > 0 ? (
                  versionHistory.map((v, idx) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.versionHistoryItem,
                        v.id === currentEstimate.id && { backgroundColor: `${colors.accent}08` },
                        idx < versionHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider },
                      ]}
                      onPress={() => {
                        if (v.id !== currentEstimate.id) {
                          navigation.replace('EstimateDetail', { estimateId: v.id });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.versionHistoryItemLeft}>
                        <View style={[
                          styles.versionDot,
                          { backgroundColor: v.id === currentEstimate.id ? colors.accent : colors.textSecondary }
                        ]} />
                        <View>
                          <Text style={[styles.versionHistoryItemTitle, { color: colors.text }]}>
                            Version {v.version || idx + 1}
                            {v.isLatestVersion ? ' (Latest)' : ''}
                          </Text>
                          <Text style={[styles.versionHistoryItemDate, { color: colors.textSecondary }]}>
                            {new Date(v.createDatetime).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                            {' · '}{v.approved ? 'Approved' : v.sent ? 'Sent' : 'Draft'}
                            {' · '}{formatCurrency(v.total)}
                          </Text>
                        </View>
                      </View>
                      {v.id === currentEstimate.id ? (
                        <Icon name="check" size={16} color={colors.accent} />
                      ) : (
                        <Icon name="chevron-right" size={16} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[styles.versionHistoryEmpty, { color: colors.textSecondary }]}>
                    No previous versions
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ===== MEGA SECTION 1: Estimate Info + Client + Schedule ===== */}
        <View style={[styles.megaSection, { backgroundColor: colors.surface }]}>
          {/* 1. Estimate Information */}
          <View style={[styles.megaSectionInner, {backgroundColor: colors.surface}]}>
            <View style={styles.sectionLabelRow}>
              <Icon name="file-text" size={15} color={colors.accent} />
              <Text style={[styles.sectionLabel, {color: colors.text}]}>Details</Text>
            </View>
            {currentEstimate.description && (
              <View style={[styles.descriptionContainer, {marginTop: theme.spacing.sm}]}>
                <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Description</Text>
                <Text style={[styles.descriptionText, {color: colors.text}]}>
                  {currentEstimate.description}
                </Text>
              </View>
            )}
            <View style={[styles.detailRow, !currentEstimate.description && {marginTop: theme.spacing.sm}]}>
              <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Status</Text>
              <View style={[styles.statusBadgeInline, {backgroundColor: `${status.color}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12}]}>
                <View style={[styles.statusDotInline, { backgroundColor: status.color }]} />
                <Text style={[styles.statusTextInline, { color: status.color }]}>{status.text}</Text>
              </View>
            </View>
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
              <View
                style={[styles.selectorRow, {borderColor: currentEstimate.client ? colors.accent : colors.border, backgroundColor: currentEstimate.client ? `${colors.accent}06` : colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
              >
                <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                  <Icon name="user" size={16} color={colors.accent} />
                </View>
                <View style={styles.selectorContent}>
                  <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Client</Text>
                  <Text style={[styles.selectorValue, {color: currentEstimate.client ? colors.text : colors.textSecondary}]} numberOfLines={1}>
                    {currentEstimate.client?.contactName || 'No client assigned'}
                  </Text>
                  {currentEstimate.client?.email && (
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>{currentEstimate.client.email}</Text>
                  )}
                  {currentEstimate.client?.phone && (
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>{currentEstimate.client.phone}</Text>
                  )}
                </View>
                <Icon name="chevron-right" size={18} color={colors.textSecondary} />
              </View>
              {currentEstimate.location ? (
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
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Location</Text>
                    <Text style={[styles.selectorValue, {color: colors.text}]} numberOfLines={1}>
                      {currentEstimate.location.addressLine1}
                    </Text>
                    <Text style={{fontSize: theme.fontSize.xs, color: colors.textSecondary, marginTop: 1}}>
                      {currentEstimate.location.city}, {currentEstimate.location.state} {currentEstimate.location.zipcode}
                    </Text>
                  </View>
                  <Icon 
                    name={mapExpanded ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
                
                {mapExpanded && (() => {
                  console.log('[EstimateDetail] Rendering map section - mapExpanded:', mapExpanded);
                  console.log('[EstimateDetail] Platform:', Platform.OS);
                  
                  if (!currentEstimate.location?.latitude || !currentEstimate.location?.longitude) {
                    console.warn('[EstimateDetail] ⚠️ Missing coordinates');
                    return (
                      <View style={[styles.mapContainer, {backgroundColor: colors.surface}]}>
                        <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }]}>
                          <Icon name="alert-circle" size={40} color={colors.textSecondary} />
                          <Text style={{ marginTop: 8, color: colors.textSecondary }}>No coordinates available</Text>
                        </View>
                      </View>
                    );
                  }
                  
                  const lat = currentEstimate.location.latitude;
                  const lng = currentEstimate.location.longitude;
                  const address = currentEstimate.location.addressLine1 || '';
                  const cityState = `${currentEstimate.location.city}, ${currentEstimate.location.state}`;
                  
                  console.log('[EstimateDetail] ✅ Coordinates:', { lat, lng });
                  
                  const handleOpenInMaps = () => {
                    const url = Platform.select({
                      ios: `maps:?q=${lat},${lng}`,
                      android: `geo:${lat},${lng}?q=${lat},${lng}(${address})`,
                    });
                    console.log('[EstimateDetail] Opening maps with URL:', url);
                    Linking.openURL(url!).catch((err) => {
                      console.error('[EstimateDetail] Error opening maps:', err);
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
                          onMapReady={() => console.log('[EstimateDetail] ✅ MapView ready')}
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
                <View
                  style={[styles.selectorRow, {borderColor: colors.border, backgroundColor: colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="map-pin" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Location</Text>
                    <Text style={[styles.selectorValue, {color: colors.textSecondary}]}>No location assigned</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                </View>
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
          
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Proposed Start</Text>
                <TouchableOpacity 
                  style={[styles.dateDisplay, {backgroundColor: colors.background, borderColor: colors.border}]}
                  onPress={() => setShowProposedDatePicker(true)}
                >
                  <Icon name="calendar" size={16} color={colors.accent} />
                  <Text style={[styles.dateText, {color: colors.text}, styles.dateTextEditable]}>
                    {currentEstimate.proposedStartDate 
                      ? new Date(currentEstimate.proposedStartDate).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })
                      : 'Proposed start'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateField}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Expires</Text>
                <TouchableOpacity 
                  style={[styles.dateDisplay, {backgroundColor: colors.background, borderColor: colors.border}]}
                  onPress={() => setShowExpirationDatePicker(true)}
                >
                  <Icon name="calendar" size={16} color={colors.accent} />
                  <Text style={[styles.dateText, {color: colors.text}, styles.dateTextEditable]}>
                    {currentEstimate.expirationDate 
                      ? new Date(currentEstimate.expirationDate).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })
                      : 'Set expiration'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <CalendarPicker
              visible={showProposedDatePicker}
              onClose={() => setShowProposedDatePicker(false)}
              onSelectDate={(date) => {
                updateEstimate(estimateId, {
                  proposedStartDate: date.toISOString(),
                  expirationDate: currentEstimate.expirationDate,
                  name: currentEstimate.name,
                  description: currentEstimate.description,
                  clientId: currentEstimate.client?.id,
                  locationId: currentEstimate.location?.id,
                  items: currentEstimate.lineItems || [],
                  id: estimateId,
                });
                setShowProposedDatePicker(false);
              }}
              onClear={() => {
                updateEstimate(estimateId, {
                  proposedStartDate: undefined,
                  expirationDate: currentEstimate.expirationDate,
                  name: currentEstimate.name,
                  description: currentEstimate.description,
                  clientId: currentEstimate.client?.id,
                  locationId: currentEstimate.location?.id,
                  items: currentEstimate.lineItems || [],
                  id: estimateId,
                });
              }}
              selectedDate={currentEstimate.proposedStartDate 
                ? new Date(currentEstimate.proposedStartDate) 
                : undefined}
              minimumDate={new Date()}
              title="Proposed Start Date"
            />
            <CalendarPicker
              visible={showExpirationDatePicker}
              onClose={() => setShowExpirationDatePicker(false)}
              onSelectDate={(date) => {
                updateEstimate(estimateId, {
                  proposedStartDate: currentEstimate.proposedStartDate,
                  expirationDate: date.toISOString(),
                  name: currentEstimate.name,
                  description: currentEstimate.description,
                  clientId: currentEstimate.client?.id,
                  locationId: currentEstimate.location?.id,
                  items: currentEstimate.lineItems || [],
                  id: estimateId,
                });
                setShowExpirationDatePicker(false);
              }}
              onClear={() => {
                updateEstimate(estimateId, {
                  proposedStartDate: currentEstimate.proposedStartDate,
                  expirationDate: undefined,
                  name: currentEstimate.name,
                  description: currentEstimate.description,
                  clientId: currentEstimate.client?.id,
                  locationId: currentEstimate.location?.id,
                  items: currentEstimate.lineItems || [],
                  id: estimateId,
                });
              }}
              selectedDate={currentEstimate.expirationDate 
                ? new Date(currentEstimate.expirationDate) 
                : undefined}
              minimumDate={new Date()}
              title="Expiration Date"
            />
          </View>
        </View>

        {/* Line Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Line Items</Text>
            <Text style={[styles.itemCount, {color: colors.textSecondary}]}>
              {currentEstimate.lineItems?.length || currentEstimate.inventory?.length || 0} items
            </Text>
          </View>

          {(currentEstimate.lineItems && currentEstimate.lineItems.length > 0) ? (
            currentEstimate.lineItems.map((item, index) => {
              const isLabor = item.type === 'labor';
              const displayPrice = isLabor
                ? (item.labor || 0) * (item.laborRate || 0)
                : (item.sellPrice || 0) * item.quantity;
              
              // Get associated media for this line item
              const itemMedia = item.mediaIds && currentEstimate.media
                ? currentEstimate.media.filter(m => item.mediaIds?.includes(m.id))
                : [];

              return (
                <View key={item.id || index} style={[styles.lineItem, {backgroundColor: colors.surface}]}>
                  <View style={styles.lineItemContent}>
                    <View style={styles.lineItemHeader}>
                      {isLabor && (
                        <View style={[styles.laborBadge, {backgroundColor: `${colors.warning}20`}]}>
                          <Icon name="clock" size={10} color={colors.textLight} />
                        </View>
                      )}
                      <Text style={[styles.lineItemName, {color: colors.text}]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <Text style={[styles.lineItemQty, {color: colors.text}]}>
                      {isLabor
                        ? `${item.labor}h × $${item.laborRate}/hr`
                        : `Qty: ${item.quantity} × ${formatCurrency(item.sellPrice || 0)}`
                      }
                    </Text>
                    {/* Associated media thumbnails */}
                    {itemMedia.length > 0 && (
                      <View style={styles.lineItemMedia}>
                        {itemMedia.slice(0, 3).map((media) => (
                          <Image
                            key={media.id}
                            source={{ uri: media.thumbnailUri || media.uri }}
                            style={styles.lineItemThumb}
                          />
                        ))}
                        {itemMedia.length > 3 && (
                          <View style={[styles.lineItemThumbMore, {backgroundColor: colors.background}]}>
                            <Text style={[styles.lineItemThumbMoreText, {color: colors.text}]}>+{itemMedia.length - 3}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.lineItemPrice, {color: colors.text}]}>
                    {formatCurrency(displayPrice)}
                  </Text>
                </View>
              );
            })
          ) : currentEstimate.inventory && currentEstimate.inventory.length > 0 ? (
            currentEstimate.inventory.map((item, index) => (
              <View key={item.id || index} style={[styles.lineItem, {backgroundColor: colors.surface}]}>
                <View style={styles.lineItemContent}>
                  <Text style={[styles.lineItemName, {color: colors.text}]} numberOfLines={2}>
                    {item.title || item.description}
                  </Text>
                  <Text style={[styles.lineItemQty, {color: colors.text}]}>Qty: {item.quantity}</Text>
                </View>
                <Text style={[styles.lineItemPrice, {color: colors.text}]}>
                  {formatCurrency(item.price * item.quantity)}
                </Text>
              </View>
            ))
          ) : (
            <View style={[styles.emptyItems, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              <Icon name="package" size={24} color={colors.textSecondary} />
              <Text style={[styles.emptyItemsText, {color: colors.textSecondary}]}>No items added</Text>
            </View>
          )}
        </View>

        {/* Gallery Section - after Items to match Create Estimate order */}
        <View style={styles.section}>
          <EstimateGallery
            estimateId={currentEstimate.id}
            readOnly={true}
            estimate={{
              media: currentEstimate.media || [],
              albums: currentEstimate.albums || [],
            }}
          />
        </View>

        {/* Financials Section */}
        <View style={styles.section}>
          <View style={[styles.totalCard, {backgroundColor: colors.surface}]}>
            {currentEstimate.totalCost !== undefined && currentEstimate.totalCost !== currentEstimate.total && (
              <>
                <View style={styles.totalRow}>
                  <Text style={[styles.subtotalLabel, {color: colors.textSecondary}]}>Materials Cost</Text>
                  <Text style={[styles.subtotalValue, {color: colors.text}]}>{formatCurrency(currentEstimate.totalCost)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.subtotalLabel, {color: colors.textSecondary}]}>Profit</Text>
                  <Text style={[styles.subtotalValue, { color: colors.success }]}>
                    +{formatCurrency(currentEstimate.total - currentEstimate.totalCost)}
                  </Text>
                </View>
                <View style={[styles.totalDivider, {backgroundColor: colors.divider}]} />
              </>
            )}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: colors.text}]}>Total Price</Text>
              <Text style={[styles.totalValue, {color: colors.accent}]}>{formatCurrency(currentEstimate.total)}</Text>
            </View>
          </View>
        </View>

        {/* Share Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Share</Text>
          <View style={styles.shareGrid}>
            <TouchableOpacity 
              style={[styles.shareButton, {backgroundColor: colors.surface}, isShareLoading && styles.shareButtonDisabled]} 
              onPress={handleShare}
              disabled={isShareLoading}
            >
              {isShareLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Icon name="share" size={20} color={colors.accent} />
              )}
              <Text style={[styles.shareButtonText, {color: colors.text}]}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.shareButton, {backgroundColor: colors.surface}, isSmsLoading && styles.shareButtonDisabled]} 
              onPress={handleShareSMS}
              disabled={isSmsLoading}
            >
              {isSmsLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Icon name="message-circle" size={20} color={colors.accent} />
              )}
              <Text style={[styles.shareButtonText, {color: colors.text}]}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.shareButton, {backgroundColor: colors.surface}, isEmailLoading && styles.shareButtonDisabled]} 
              onPress={handleShareEmail}
              disabled={isEmailLoading}
            >
              {isEmailLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Icon name="mail" size={20} color={colors.accent} />
              )}
              <Text style={[styles.shareButtonText, {color: colors.text}]}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.shareButton, {backgroundColor: colors.surface}, isLinkLoading && styles.shareButtonDisabled]} 
              onPress={handleShareAsLink}
              disabled={isLinkLoading}
            >
              {isLinkLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Icon name="link" size={20} color={colors.accent} />
              )}
              <Text style={[styles.shareButtonText, {color: colors.text}]}>Link</Text>
            </TouchableOpacity>
          </View>

          {/* View tracking info */}
          {currentEstimate.viewCount !== undefined && currentEstimate.viewCount > 0 && (
            <View style={[styles.viewTrackingRow, {borderTopColor: colors.border}]}>
              <Icon name="eye" size={14} color={colors.success} />
              <Text style={[styles.viewTrackingText, {color: colors.accent}]}>
                Viewed {currentEstimate.viewCount} time{currentEstimate.viewCount !== 1 ? 's' : ''}
                {currentEstimate.lastViewedAt && (
                  ` • Last: ${new Date(currentEstimate.lastViewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                )}
              </Text>
            </View>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={[styles.actionButton, {backgroundColor: colors.surface}]} onPress={handleDuplicate}>
              <Icon name="copy" size={20} color={colors.accent} />
              <Text style={[styles.actionButtonText, {color: colors.text}]}>Duplicate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, {backgroundColor: colors.surface}]} onPress={() => setShowSaveTemplateModal(true)}>
              <Icon name="folder-plus" size={20} color={colors.accent} />
              <Text style={[styles.actionButtonText, {color: colors.text}]}>Save as Template</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonFull, {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent}]}
            onPress={handleCreateVersion}
            disabled={isCreatingVersion}
          >
            {isCreatingVersion ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Icon name="git-branch" size={20} color={colors.accent} />
            )}
            <Text style={[styles.actionButtonText, {color: colors.accent}]}>
              {isCreatingVersion ? 'Creating...' : 'Create New Version'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity             style={[styles.actionButton, styles.actionButtonPrimary, {backgroundColor: colors.accent}, styles.actionButtonFull]}
            onPress={() => setShowConvertModal(true)}>
            <Icon name="briefcase" size={20} color={colors.textLight} />
            <Text style={[styles.actionButtonTextPrimary, {color: colors.textLight}]}>Convert to Job</Text>
          </TouchableOpacity>

          <TouchableOpacity             style={[styles.deleteButton, {backgroundColor: `${colors.error}10`}]}
            onPress={() => setShowDeleteModal(true)}>
            <Icon name="trash-2" size={18} color={colors.error} />
            <Text style={[styles.deleteButtonText, {color: colors.error}]}>Delete Estimate</Text>
          </TouchableOpacity>
        </View>

        {/* Created Info - moved from Overview */}
        <View style={styles.createdInfo}>
          <Icon name="calendar" size={14} color={colors.textSecondary} />
          <Text style={[styles.createdInfoText, {color: colors.textSecondary}]}>
            Created {formatDate(currentEstimate.createDatetime)}
          </Text>
        </View>

      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={showDeleteModal}
        title="Delete Estimate?"
        message="This action cannot be undone. Are you sure you want to delete this estimate?"
        icon="trash-2"
        iconColor={colors.error}
        buttons={[
          { text: 'Cancel', onPress: () => setShowDeleteModal(false), style: 'cancel' },
          { text: isDeleting ? 'Deleting...' : 'Delete', onPress: handleDelete },
        ]}
      />

      {/* Convert to Job Modal */}
      <ConfirmationModal
        visible={showConvertModal}
        title="Convert to Job?"
        message="This will create a new job from this estimate. The estimate will be marked as approved."
        icon="briefcase"
        iconColor={colors.accent}
        buttons={[
          { text: 'Cancel', onPress: () => setShowConvertModal(false), style: 'cancel' },
          { text: isConverting ? 'Converting...' : 'Convert', onPress: handleCheckAndConvert },
        ]}
      />

      {/* Overallocation Warning Modal */}
      <Modal visible={showOverallocationModal} transparent animationType="fade">
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20}}>
          <View style={{backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', maxHeight: '80%'}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16}}>
              <Icon name="alert-triangle" size={24} color={colors.warning} />
              <Text style={{fontSize: 18, fontWeight: '700', color: colors.text, flex: 1}}>Inventory Overallocation</Text>
            </View>
            <Text style={{fontSize: 14, color: colors.textSecondary, marginBottom: 16}}>
              Some items in this estimate are also allocated to other active jobs:
            </Text>
            <ScrollView style={{maxHeight: 200, marginBottom: 16}}>
              {overallocationData?.conflicts?.map((conflict: any, idx: number) => (
                <View key={idx} style={{paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider}}>
                  <Text style={{fontSize: 14, fontWeight: '600', color: colors.text}}>{conflict.itemTitle}</Text>
                  <Text style={{fontSize: 12, color: colors.textSecondary, marginTop: 2}}>
                    Requested: {conflict.requestedQuantity} · Available: {conflict.availableQuantity} · Already allocated: {conflict.totalAlreadyAllocated}
                  </Text>
                  {conflict.isOverallocated && (
                    <Text style={{fontSize: 12, color: colors.error, fontWeight: '600', marginTop: 2}}>⚠ Overallocated</Text>
                  )}
                  {conflict.conflictingJobs?.map((job: any, jIdx: number) => (
                    <Text key={jIdx} style={{fontSize: 11, color: colors.textSecondary, marginTop: 2, paddingLeft: 8}}>
                      → {job.jobNumber}: {job.jobTitle} ({job.allocatedQuantity} units)
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <View style={{gap: 8}}>
              <TouchableOpacity
                style={{backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 10, alignItems: 'center'}}
                onPress={doConvert}
              >
                <Text style={{color: '#FFFFFF', fontSize: 15, fontWeight: '600'}}>Reserve Inventory & Convert</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{backgroundColor: colors.background, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border}}
                onPress={() => { setShowOverallocationModal(false); doConvert(); }}
              >
                <Text style={{color: colors.text, fontSize: 15, fontWeight: '600'}}>Purchase Later (Hold)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{paddingVertical: 10, alignItems: 'center'}}
                onPress={() => setShowOverallocationModal(false)}
              >
                <Text style={{color: colors.textSecondary, fontSize: 14}}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Update Existing Job Modal */}
      <ConfirmationModal
        visible={showUpdateJobModal}
        title="Job Already Exists"
        message={`A job "${linkedJob?.title || ''}" was already created from a previous version of this estimate. Would you like to update it or create a new job?`}
        icon="alert-circle"
        iconColor={colors.warning}
        buttons={[
          { text: 'Update Existing Job', onPress: doUpdateExistingJob },
          { text: 'Create New Job', onPress: () => { setShowUpdateJobModal(false); doConvert(); } },
          { text: 'Cancel', onPress: () => setShowUpdateJobModal(false), style: 'cancel' },
        ]}
      />

      {/* Save as Template Modal */}
      <ConfirmationModal
        visible={showSaveTemplateModal}
        title="Save as Template?"
        message="This will create a reusable template from this estimate that you can use for future projects."
        icon="folder-plus"
        iconColor={colors.accent}
        buttons={[
          { text: 'Cancel', onPress: () => setShowSaveTemplateModal(false), style: 'cancel' },
          { text: isSavingTemplate ? 'Saving...' : 'Save Template', onPress: handleSaveAsTemplate },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.fontSize.md,

  },

  // Status Banner
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerEstimateNumber: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },

  // Approval Banner
  approvalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  approvalBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalBannerContent: {
    flex: 1,
  },
  approvalBannerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  approvalBannerSubtitle: {
    fontSize: theme.fontSize.sm,
    marginTop: 2,
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
  megaSectionDivider: {
    height: 1,

    marginHorizontal: theme.spacing.md,
  },

  // Section
  section: {
    marginBottom: theme.spacing.lg,
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
  sectionSubtitle: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
  },
  itemCount: {
    fontSize: theme.fontSize.sm,

  },

  // Card
  card: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  description: {
    fontSize: theme.fontSize.md,

    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.fontSize.sm,

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
  clientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  clientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginBottom: 2,
  },
  clientDetail: {
    fontSize: theme.fontSize.sm,

  },
  divider: {
    height: 1,

    marginVertical: theme.spacing.md,
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

  // Detail Row
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
  
  // Status Badge Inline (matching JobDetail)
  statusBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotInline: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTextInline: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  descriptionContainer: {
    gap: theme.spacing.xs,
  },
  descriptionText: {
    fontSize: theme.fontSize.md,

    lineHeight: 22,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,

    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },

  // Schedule Date Fields
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
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

    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: theme.fontSize.sm,

  },
  dateTextEditable: {

    fontWeight: theme.fontWeight.medium,
  },

  // Line Items
  lineItem: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  lineItemContent: {
    flex: 1,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: theme.fontSize.md,

    marginBottom: 4,
    flex: 1,
  },
  lineItemQty: {
    fontSize: theme.fontSize.sm,

  },
  lineItemMedia: {
    flexDirection: 'row',
    gap: 4,
    marginTop: theme.spacing.xs,
  },
  lineItemThumb: {
    width: 28,
    height: 28,
    borderRadius: 4,

  },
  lineItemThumbMore: {
    width: 28,
    height: 28,
    borderRadius: 4,

    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemThumbMoreText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.medium,

  },
  lineItemPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  emptyItems: {

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyItemsText: {
    fontSize: theme.fontSize.sm,

  },

  // Total
  totalCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  subtotalLabel: {
    fontSize: theme.fontSize.sm,

    opacity: 0.8,
  },
  subtotalValue: {
    fontSize: theme.fontSize.md,

    opacity: 0.9,
  },
  totalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: theme.spacing.sm,
  },
  totalLabel: {
    fontSize: theme.fontSize.lg,

  },
  totalValue: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,

  },

  // Share
  shareGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  shareButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadow.sm,
  },
  shareButtonDisabled: {
    opacity: 0.7,
  },
  shareButtonText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  viewTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,

  },
  viewTrackingText: {
    fontSize: theme.fontSize.sm,

  },

  // Actions
  actionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,

  },
  actionButtonPrimary: {
  },
  actionButtonFull: {
    flex: undefined,
    marginBottom: theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  actionButtonTextPrimary: {
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  deleteButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
  },
  titleSection: {
    marginBottom: theme.spacing.md,
  },
  createdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  createdInfoText: {
    fontSize: theme.fontSize.sm,

  },

  // Versioning
  versionSection: {
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  versionBadgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  latestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  latestBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  versionHistoryPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  versionHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  versionHistoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  versionHistoryItemTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  versionHistoryItemDate: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  versionHistoryEmpty: {
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
});
