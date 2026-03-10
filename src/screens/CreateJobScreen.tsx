import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useClient } from '../context/ClientContext';
import { useJob } from '../context/JobContext';
import { useEstimate } from '../context/EstimateContext';
import { Button } from '../components/Button';
import { ScreenHeader, AnimatedPressable, CalendarPicker, LineItemRow, InventoryItemPicker } from '../components/ui';
import type { LineItemData } from '../components/ui/LineItemRow';
import { EstimateGallery } from '../components/EstimateGallery';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { RouteProp } from '@react-navigation/native';
import type { JobStatus, InventoryAllocation } from '../types/job';
import { JOB_STATUS_LABELS, getJobStatusColor } from '../types/job';
import type { InventoryItem } from '../types/navigation';

import { useInventory } from '../context/InventoryContext';
import { GoalSection } from '../components/goals';
import { RecurrencePicker } from '../components/RecurrencePicker';
import type { RecurrenceConfig, JobOccurrencesResponse, SetRecurrenceRequest, BillingFrequency } from '../types/job';
import { BILLING_FREQUENCY_LABELS } from '../types/job';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jobService } from '../services/api/domain/jobs/jobService';
import { haptics } from '../utils/haptics';

const JOB_DRAFT_KEY = '@nmj_job_draft';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreateJob'>;
  route: RouteProp<RootStackParamList, 'CreateJob'>;
}

// Status is now auto-determined based on schedule dates

export const CreateJobScreen: React.FC<Props> = ({ navigation, route }) => {
  const { clients, loadClients } = useClient();
  const { createJob, updateJob, currentJob, addJobNote, setRecurrence, getOccurrences } = useJob();
  const { draftEstimate, updateDraft, initDraft, clearDraft, addLineItem, updateLineItem, removeLineItem } = useEstimate();
  const { items: inventoryItems, customCategories } = useInventory();

  // Get pre-selected client, template, and edit mode from route params
  const preSelectedClientId = route.params?.clientId;
  const templateId = route.params?.templateId;
  const editMode = route.params?.editMode;
  const isNewJob = route.params?.isNewJob;


  // Track if initial setup has been done
  const hasInitialized = useRef(false);

  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<JobStatus>('draft');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [lineItemsExpanded, setLineItemsExpanded] = useState(true);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);

  // Notes state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Helper to build SetRecurrenceRequest from RecurrenceConfig
  const buildRecurrenceRequest = useCallback((cfg: RecurrenceConfig): SetRecurrenceRequest => {
    const parts: string[] = [
      `FREQ=${cfg.frequency}`,
      `INTERVAL=${cfg.interval}`,
    ];
    if (cfg.nthWeekday && cfg.frequency === 'MONTHLY') {
      parts.push(`BYDAY=${cfg.nthWeekday.position}${cfg.nthWeekday.day}`);
    } else if (cfg.byDay && cfg.byDay.length > 0) {
      parts.push(`BYDAY=${cfg.byDay.join(',')}`);
    }
    if (cfg.endType === 'after_count' && cfg.count) {
      parts.push(`COUNT=${cfg.count}`);
    }

    const req: SetRecurrenceRequest = {
      recurrenceRule: parts.join(';'),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    if (cfg.endType === 'on_date' && cfg.endDate) {
      // Convert RRULE UNTIL format (20250101T000000Z) to ISO date
      try {
        const d = new Date(cfg.endDate.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'));
        req.recurrenceEndDate = d.toISOString();
      } catch {
        // ignore parse error
      }
    }

    return req;
  }, []);

  // Billing frequency state
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency | null>(
    editMode && currentJob?.billingFrequency ? currentJob.billingFrequency as BillingFrequency : null
  );

  // Recurrence state
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig | null>(null);
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState<JobOccurrencesResponse | null>(null);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);

  // Bidirectional binding: recurrence ↔ start date
  // When recurrence is activated and no start date exists, auto-set to today
  useEffect(() => {
    if (recurrenceConfig && !startDate) {
      setStartDate(new Date());
    }
  }, [recurrenceConfig, startDate]);

  // Materials state - now using lineItems from draftEstimate
  interface SelectedMaterial {
    item: InventoryItem;
    percentage: number;
    quantity: number;
  }
  const [selectedMaterials, setSelectedMaterials] = useState<SelectedMaterial[]>([]);

  // Line items from template
  const [templateLineItems, setTemplateLineItems] = useState<any[]>([]);
  // Media and albums from template
  const [templateMedia, setTemplateMedia] = useState<any[]>([]);
  const [templateAlbums, setTemplateAlbums] = useState<any[]>([]);

  // Load saved draft on mount (auto-save restore)
  // If isNewJob is true, clear any saved draft instead of restoring it
  useEffect(() => {
    if (editMode) return; // Don't restore draft in edit mode
    
    const handleDraft = async () => {
      try {
        // If creating a new job explicitly, clear any saved draft
        if (isNewJob) {
          console.log('[CreateJob] isNewJob=true, clearing saved draft');
          await AsyncStorage.removeItem(JOB_DRAFT_KEY);
          return;
        }
        
        // Otherwise, try to restore saved draft
        const saved = await AsyncStorage.getItem(JOB_DRAFT_KEY);
        if (saved) {
          let draft;
          try {
            draft = JSON.parse(saved);
          } catch (parseErr) {
            console.error('[CreateJob] Corrupted draft data, clearing:', parseErr);
            await AsyncStorage.removeItem(JOB_DRAFT_KEY);
            return;
          }
          console.log('[CreateJob] Restoring saved draft:', draft.title);
          setTitle(draft.title || '');
          setDescription(draft.description || '');
          setStatus(draft.status || 'scheduled');
          if (draft.startDate) setStartDate(new Date(draft.startDate));
          if (draft.endDate) setEndDate(new Date(draft.endDate));
          if (draft.clientId) {
            updateDraft({ clientId: draft.clientId, client: draft.client });
          }
          if (draft.locationId) {
            updateDraft({ locationId: draft.locationId, location: draft.location });
          }
          if (draft.lineItems?.length > 0) {
            updateDraft({ lineItems: draft.lineItems });
          }
        }
      } catch (err) {
        console.error('[CreateJob] Error handling draft:', err);
      }
    };
    handleDraft();
  }, [editMode, isNewJob, updateDraft]);

  // Auto-save draft when form changes
  useEffect(() => {
    if (editMode) return; // Don't auto-save in edit mode
    
    const saveDraft = async () => {
      const draft = {
        title,
        description,
        status,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        clientId: draftEstimate?.clientId,
        client: draftEstimate?.client,
        locationId: draftEstimate?.locationId,
        location: draftEstimate?.location,
        lineItems: draftEstimate?.lineItems,
      };
      try {
        await AsyncStorage.setItem(JOB_DRAFT_KEY, JSON.stringify(draft));
      } catch (err) {
        console.error('[CreateJob] Error saving draft:', err);
      }
    };
    
    // Debounce save to avoid too many writes
    const timeout = setTimeout(saveDraft, 500);
    return () => clearTimeout(timeout);
  }, [editMode, title, description, status, startDate, endDate, draftEstimate?.clientId, draftEstimate?.locationId, draftEstimate?.lineItems]);

  // Clear saved draft on successful save
  const clearSavedDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(JOB_DRAFT_KEY);
    } catch (err) {
      console.error('[CreateJob] Error clearing saved draft:', err);
    }
  }, []);

  // Ensure draft exists when screen gains focus (fixes client selection after navigation)
  useFocusEffect(
    useCallback(() => {
      if (!draftEstimate && !editMode) {
        console.log('[CreateJob] Screen focused without draft, initializing...');
        initDraft();
      }
    }, [draftEstimate, editMode, initDraft])
  );

  // Initialize draft on first mount - use initDraft instead of clearDraft
  // so that draftEstimate is a valid object that can be updated
  useEffect(() => {
    loadClients();

    // Only init draft on initial mount (not when returning from navigation)
    if (!hasInitialized.current) {
      hasInitialized.current = true;

      // IMPORTANT: Init a fresh draft FIRST (creates a valid draftEstimate object)
      // This must happen before any updateDraft calls to avoid race conditions
      initDraft();

      // If edit mode and we have a currentJob, populate form with job data
      if (editMode && currentJob) {
        setTitle(currentJob.title || '');
        setDescription(currentJob.description || '');
        setStatus((currentJob.status as JobStatus) || 'scheduled');
        if (currentJob.scheduledStartDate) {
          setStartDate(new Date(currentJob.scheduledStartDate));
        }
        if (currentJob.scheduledEndDate) {
          setEndDate(new Date(currentJob.scheduledEndDate));
        }
        // Update draft with client info
        if (currentJob.client) {
          updateDraft({ clientId: currentJob.client.id, client: currentJob.client as any });
        }
        if (currentJob.location) {
          updateDraft({ locationId: currentJob.location.id, location: currentJob.location as any });
        }
        // Store media and albums for display
        if (currentJob.media && (currentJob.media as any[]).length > 0) {
          setTemplateMedia(currentJob.media as any[]);
        }
        if (currentJob.albums && (currentJob.albums as any[]).length > 0) {
          setTemplateAlbums(currentJob.albums as any[]);
        }
        // Log the full currentJob to debug
        console.log('[CreateJobScreen] currentJob in init:', {
          id: currentJob.id,
          title: currentJob.title,
          jobInventoryLength: currentJob.jobInventory?.length,
          jobInventory: currentJob.jobInventory,
          lineItemsLength: (currentJob as any).lineItems?.length,
        });
        // Convert jobInventory to lineItems and add to draft
        if (currentJob.jobInventory && currentJob.jobInventory.length > 0) {
          console.log('[CreateJobScreen] Loading jobInventory from currentJob:', currentJob.jobInventory.length, currentJob.jobInventory);
          const convertedItems = currentJob.jobInventory.map((inv: any) => ({
            id: inv.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: inv.title || inv.description || 'Material',
            quantity: inv.idealQuantity || inv.quantity || 1,
            cost: inv.price || 0,
            sellPrice: inv.price || 0,
            labor: inv.labor || 0,
            laborRate: inv.labor || 0,
            type: inv.labor > 0 ? 'labor' : 'material' as const,
            category: inv.category,
            // Preserve original IDs for update
            originalId: inv.id,
            productId: inv.productId,
            warehouseId: inv.warehouseId,
          }));
          console.log('[CreateJobScreen] Converted to templateLineItems:', convertedItems.length, convertedItems);
          setTemplateLineItems(convertedItems);
        }
        // Also load lineItems from job if present
        if (currentJob.lineItems && (currentJob as any).lineItems.length > 0) {
          setTemplateLineItems((currentJob as any).lineItems);
        }
        // Load recurrence config
        if (currentJob.isRecurring && currentJob.recurrenceRule) {
          // Parse existing RRULE into config - RecurrencePicker will handle this internally
          setRecurrenceConfig({ frequency: 'WEEKLY', interval: 1 }); // Will be overridden by RecurrencePicker's parseRRule
        }
      } else if (templateId) {
        // Template loading not implemented yet
        console.warn('Template loading not implemented');
        const template: any = null;
        if (template) {
          setTitle(template.name);
          setDescription(template.description || '');
          if (template.lineItems && template.lineItems.length > 0) {
            setTemplateLineItems(template.lineItems);
          } else if (template.inventory && template.inventory.length > 0) {
            const convertedItems = template.inventory.map((inv: any) => ({
              id: inv.id,
              description: inv.title || inv.description,
              quantity: inv.quantity,
              cost: inv.price,
              sellPrice: inv.price,
              type: 'material' as const,
            }));
            setTemplateLineItems(convertedItems);
          }
          if (template.media && template.media.length > 0) {
            setTemplateMedia(template.media);
          }
          if (template.albums && template.albums.length > 0) {
            setTemplateAlbums(template.albums);
          }
        }
      }
    }
  }, [loadClients, initDraft, templateId, editMode, currentJob, updateDraft]);

  // Auto-set status based on dates (scheduled if dates set, draft otherwise)
  useEffect(() => {
    if (editMode) return; // Don't auto-change status in edit mode
    
    if (startDate || endDate) {
      setStatus('scheduled');
    } else {
      setStatus('draft');
    }
  }, [startDate, endDate, editMode]);

  // Pre-select client if provided via route params OR Edit Mode
  useEffect(() => {
    // Case 1: Route param
    if (preSelectedClientId && clients.length > 0 && !draftEstimate?.clientId) {
      const client = clients.find(c => c.id === preSelectedClientId);
      if (client) {
        updateDraft({ clientId: client.id, client });
      }
    }
    // Case 2: Edit Mode with currentJob
    if (editMode && currentJob?.client && clients.length > 0 && !draftEstimate?.clientId) {
      const client = clients.find(c => c.id === currentJob.client?.id);
      if (client) {
        updateDraft({ clientId: client.id, client });
      } else {
        // Fallback if client not found in list but exists in job
        updateDraft({ clientId: currentJob.client.id, client: currentJob.client as any });
      }
    }
  }, [preSelectedClientId, editMode, currentJob, clients, updateDraft, draftEstimate?.clientId]);

  // Populate line items and media from templates/jobs
  useEffect(() => {
    if (draftEstimate) {
      // Line Items - use updateDraft to set all at once instead of looping addLineItem
      if (templateLineItems.length > 0) {
        console.log('[CreateJobScreen] Adding templateLineItems to draft:', templateLineItems.length);
        // Merge with existing line items (if any)
        const existingItems = draftEstimate.lineItems || [];
        const newItems = templateLineItems.map(item => ({
          ...item,
          id: item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        }));
        console.log('[CreateJobScreen] Updating draft with lineItems:', [...existingItems, ...newItems].length);
        updateDraft({ lineItems: [...existingItems, ...newItems] });
        setTemplateLineItems([]);
      }

      // Allocations/Inventory already handled by templateLineItems conversion? 
      // Assuming jobInventory was converted to templateLineItems.

      // Media
      if (templateMedia.length > 0) {
        // We need to add media to the draft
        // Ideally updateDraft should handle merging, but simple assignment might work if property exists
        // Since updateDraft usually takes partial<Estimate>, we rely on it.
        // However, draftEstimate structure might differ from JobMediaRM.
        // We expect EstimateMediaRM[] for draftEstimate.media

        // Convert JobMediaRM to EstimateMediaRM-like structure if needed, or pass as is if compatible
        const mediaToAdd = templateMedia.map(m => ({
          ...m,
          // Ensure fields match what EstimateGallery expects
          uri: m.webUrl || m.uri || m.url,
          thumbnailUri: m.thumbUrl || m.thumbnailUri || m.thumbnailUrl,
        }));

        // Use a direct update if possible, or we might need a specific action. 
        // updateDraft merges.
        if (!draftEstimate.media || draftEstimate.media.length === 0) {
          updateDraft({ media: mediaToAdd });
          setTemplateMedia([]);
        }
      }

      // Albums
      if (templateAlbums.length > 0) {
        if (!draftEstimate.albums || draftEstimate.albums.length === 0) {
          updateDraft({ albums: templateAlbums });
          setTemplateAlbums([]);
        }
      }
    }
  }, [templateLineItems, templateMedia, templateAlbums, draftEstimate, updateDraft]);

  // Validation
  const isValid = title.trim().length > 0;

  // Calculate totals from line items - same logic as Estimate
  const totals = useMemo(() => {
    if (!draftEstimate?.lineItems) return { 
      materialsCost: 0, 
      materialsSellPrice: 0, 
      laborHours: 0, 
      laborCost: 0,
      profit: 0,
      total: 0 
    };
    
    let materialsCost = 0;
    let materialsSellPrice = 0;
    let laborHours = 0;
    let laborCost = 0;
    
    draftEstimate.lineItems.forEach(item => {
      if (item.type === 'labor') {
        // Labor items: hours × rate
        laborHours += item.labor || 0;
        laborCost += (item.labor || 0) * (item.laborRate || 0);
      } else {
        // Material items
        materialsCost += (item.cost || 0) * (item.quantity || 1);
        materialsSellPrice += (item.sellPrice || 0) * (item.quantity || 1);
      }
    });
    
    const profit = materialsSellPrice - materialsCost;
    const total = materialsSellPrice + laborCost;
    
    return { materialsCost, materialsSellPrice, laborHours, laborCost, profit, total };
  }, [draftEstimate?.lineItems]);

  // Handle adding materials from inventory picker
  const handleAddFromInventory = useCallback(() => {
    setShowInventoryPicker(true);
  }, []);

  // Handle inventory picker confirmation
  // sellPrice starts at 0 - user must set the selling price manually
  const handleInventoryPickerConfirm = useCallback((selected: Array<{ item: { id: string; name: string; quantity: number; price: number; category?: string }; selectedQuantity: number }>) => {
    selected.forEach(sel => {
      const newItem: LineItemData = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: sel.item.name,
        quantity: sel.selectedQuantity,
        cost: sel.item.price, // Internal cost from inventory
        sellPrice: 0, // Start at 0 - user sets selling price manually
        type: 'material',
        category: sel.item.category,
        inventoryId: sel.item.id, // Track inventory ID for deduction on job completion
      };
      addLineItem(newItem as any);
    });
  }, [addLineItem]);

  // Handle adding a manual line item
  const handleAddLineItem = useCallback(() => {
    const newItem: LineItemData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: '',
      quantity: 1,
      cost: 0,
      sellPrice: 0,
      type: 'material',
    };
    addLineItem(newItem as any);
  }, [addLineItem]);

  // Handle adding a labor item
  const handleAddLaborItem = useCallback(() => {
    const newItem: LineItemData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: '',
      quantity: 1,
      cost: 0,
      type: 'labor',
      labor: 0,
      laborRate: 0,
    };
    addLineItem(newItem as any);
  }, [addLineItem]);

  // Remove material (legacy)
  const _handleRemoveMaterial = useCallback((itemId: string) => {
    setSelectedMaterials(prev => prev.filter(m => m.item.id !== itemId));
  }, []);



  // Handle Note
  const handleAddNote = useCallback(async () => {
    if (!noteContent.trim() || !currentJob) return;

    setNoteLoading(true);
    try {
      await addJobNote(currentJob.id, { content: noteContent.trim() });
      setNoteContent('');
      setShowNoteModal(false);
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setNoteLoading(false);
    }
  }, [noteContent, currentJob, addJobNote]);

  // Check for empty sell prices
  const hasEmptySellPrices = useCallback(() => {
    if (!draftEstimate?.lineItems) return false;
    return draftEstimate.lineItems.some(item => 
      item.type !== 'labor' && (!item.sellPrice || item.sellPrice === 0)
    );
  }, [draftEstimate?.lineItems]);

  // Actual save logic
  const performSave = useCallback(async () => {
    setIsLoading(true);

    try {
      // Create inventory allocations from selected materials
      const now = new Date().toISOString();
      const _inventoryAllocations: Omit<InventoryAllocation, 'id' | 'jobId'>[] = selectedMaterials.map(m => ({
        inventoryId: m.item.id,
        inventoryTitle: m.item.name,
        requestedQty: m.quantity,
        reservedQty: m.quantity,
        usedQty: 0,
        returnedQty: 0,
        unitCost: m.item.price,
        status: 'reserved' as const,
        createdAt: now,
        updatedAt: now,
      }));

      // Map line items to job inventory format
      const jobInventoryItems = (draftEstimate?.lineItems ?? []).map(item => {
        // Check if this is a valid UUID (existing item) or a temp ID (new item)
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
        const itemData: any = item as any;

        // For labor items: labor field = hourly rate (backend multiplies by quantity)
        // For material items: labor field = associated labor rate per unit
        const laborPerUnit = item.type === 'labor'
          ? (item.laborRate || item.cost || 0) // Hourly rate only
          : (item.laborRate || 0); // Per-unit labor rate for materials

        return {
          // Use originalId if available (preserved from job), otherwise check if valid UUID
          id: itemData.originalId || (isValidUuid ? item.id : undefined),
          title: item.description || item.title,
          description: item.description || item.title || '',
          quantity: item.type === 'labor' ? (item.labor || 1) : (item.quantity || 1), // For labor, quantity = hours
          idealQuantity: item.type === 'labor' ? (item.labor || 1) : (item.quantity || 1),
          price: item.type === 'labor' ? 0 : (item.sellPrice || 0), // Labor has no material price
          labor: laborPerUnit,
          type: item.type,
          category: item.category,
          productId: itemData.productId,
          warehouseId: itemData.warehouseId,
          inventoryId: itemData.inventoryId, // Track inventory ID for deduction on job completion
        };
      }) || [];

      console.log('[CreateJobScreen] draftEstimate.lineItems:', draftEstimate?.lineItems?.length || 0, draftEstimate?.lineItems);
      console.log('[CreateJobScreen] jobInventoryItems:', jobInventoryItems.length, jobInventoryItems);

      let finalJobId: string | null = null;

      if (editMode && currentJob) {
        // Update existing job
        const updatedJob = await updateJob(currentJob.id, {
          title: title.trim(),
          description: description.trim(),
          status,
          clientId: draftEstimate?.clientId,
          locationId: draftEstimate?.locationId,
          scheduledStartDate: startDate?.toISOString(),
          scheduledEndDate: endDate?.toISOString(),
          billingFrequency: billingFrequency || undefined,
          jobInventory: jobInventoryItems as any, // Cast to match expected type logic
        });
        finalJobId = updatedJob.id;

        // Save recurrence if configured
        if (recurrenceConfig) {
          await setRecurrence(updatedJob.id, buildRecurrenceRequest(recurrenceConfig));
        } else if (currentJob.isRecurring) {
          // User disabled recurrence
          await setRecurrence(currentJob.id, { recurrenceRule: undefined });
        }
      } else {
        // Create new job
        const newJob = await createJob({
          title: title.trim(),
          description: description.trim(),
          status,
          clientId: draftEstimate?.clientId,
          locationId: draftEstimate?.locationId,
          scheduledStartDate: startDate?.toISOString(),
          scheduledEndDate: endDate?.toISOString(),
          billingFrequency: billingFrequency || undefined,
          jobInventory: jobInventoryItems as any,
        });
        finalJobId = newJob.id;

        // Link any media that was uploaded locally before save
        const localMedia = (draftEstimate?.media || []).filter((m: any) => m.isLocal && m.s3Key);
        if (localMedia.length > 0) {
          await Promise.all(localMedia.map((m: any) =>
            jobService.addMedia({
              jobId: newJob.id,
              s3Key: m.s3Key,
              fileName: m.fileName || m.s3Key.split('/').pop() || 'photo.jpg',
              type: m.type || 'image',
              mimeType: m.mimeType || 'image/jpeg',
              sizeBytes: m.sizeBytes || 0,
            }).catch((err: any) => console.warn('[CreateJob] Failed to link media:', err))
          ));
        }

        // Save recurrence if configured
        if (recurrenceConfig) {
          await setRecurrence(newJob.id, buildRecurrenceRequest(recurrenceConfig));
        }
      }

      clearDraft();
      await clearSavedDraft();
      haptics.success();
      // Navigate directly to the saved job detail (pop animation)
      if (finalJobId) {
        navigation.replace('JobDetail', { jobId: finalJobId });
      } else {
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error saving job:', error);
      Alert.alert('Error', error?.message || 'Failed to save job. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    editMode,
    currentJob,
    title,
    description,
    status,
    draftEstimate?.clientId,
    draftEstimate?.client,
    draftEstimate?.lineItems,
    draftEstimate?.locationId,
    draftEstimate?.media,
    startDate,
    endDate,
    selectedMaterials,
    templateLineItems,
    templateMedia,
    templateAlbums,
    createJob,
    updateJob,
    clearDraft,
    clearSavedDraft,
    recurrenceConfig,
    setRecurrence,
    billingFrequency,
    buildRecurrenceRequest,
    navigation,
  ]);

  // Handle save with empty sell price warning
  const handleSave = useCallback(() => {
    if (!isValid) return;

    // Check for empty sell prices
    if (hasEmptySellPrices()) {
      Alert.alert(
        'Empty Sell Prices',
        'You have items with empty sell prices. This may result in negative profit. Do you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', style: 'destructive', onPress: performSave }
        ]
      );
      return;
    }

    performSave();
  }, [isValid, hasEmptySellPrices, performSave]);


  // Handle back - auto-save in edit mode (like Estimates)
  const handleBack = useCallback(async () => {
    if (editMode && currentJob && isValid) {
      // Auto-save when going back in edit mode
      setIsLoading(true);
      try {
        const jobInventoryItems = (draftEstimate?.lineItems ?? []).map(item => {
          const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
          const itemData: any = item as any;
          const laborPerUnit = item.type === 'labor'
            ? (item.laborRate || item.cost || 0)
            : (item.laborRate || 0);

          return {
            id: itemData.originalId || (isValidUuid ? item.id : undefined),
            title: item.description || item.title,
            description: item.description || item.title || '',
            quantity: item.type === 'labor' ? (item.labor || 1) : (item.quantity || 1),
            idealQuantity: item.type === 'labor' ? (item.labor || 1) : (item.quantity || 1),
            price: item.type === 'labor' ? 0 : (item.sellPrice || 0),
            labor: laborPerUnit,
            type: item.type,
            category: item.category,
            productId: itemData.productId,
            warehouseId: itemData.warehouseId,
            inventoryId: itemData.inventoryId,
          };
        });

        await updateJob(currentJob.id, {
          title: title.trim(),
          description: description.trim(),
          status,
          clientId: draftEstimate?.clientId,
          locationId: draftEstimate?.locationId,
          scheduledStartDate: startDate?.toISOString(),
          scheduledEndDate: endDate?.toISOString(),
          jobInventory: jobInventoryItems as any,
        });
      } catch (error) {
        console.error('Error auto-saving job:', error);
      } finally {
        setIsLoading(false);
      }
    }
    navigation.goBack();
  }, [editMode, currentJob, isValid, title, description, status, draftEstimate, startDate, endDate, updateJob, navigation]);

  // Handle select client - navigate to SelectClient screen
  const handleSelectClient = useCallback(() => {
    navigation.navigate('SelectClient');
  }, [navigation]);

  // Handle select location - navigate to SelectLocation screen
  const handleSelectLocation = useCallback(() => {
    if (draftEstimate?.clientId) {
      navigation.navigate('SelectLocation', { clientId: draftEstimate.clientId });
    }
  }, [navigation, draftEstimate?.clientId]);

  // Helper functions
  const getClientName = () => {
    if (draftEstimate?.client) {
      return draftEstimate.client.contactName;
    }
    if (draftEstimate?.clientId) {
      const client = clients.find(c => c.id === draftEstimate.clientId);
      return client?.contactName || 'Unknown';
    }
    return 'Select Client';
  };

  const getLocationDisplay = () => {
    if (draftEstimate?.location) {
      const loc = draftEstimate.location;
      const addr = loc.addressLine1 || loc.name || '';
      const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
      return addr ? `${addr}${cityState ? ` · ${cityState}` : ''}` : cityState || 'Unknown location';
    }
    return 'Select Location';
  };

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title={editMode ? 'Edit Job' : 'New Job'}
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">

          {/* ═══ STATUS BANNER (top) ═══ */}
          <View style={[styles.statusBannerRow, { backgroundColor: `${getJobStatusColor(status)}10`, borderColor: `${getJobStatusColor(status)}30` }]}>
            <View style={[styles.statusBannerIcon, { backgroundColor: `${getJobStatusColor(status)}20` }]}>
              <View style={[styles.statusBannerDot, { backgroundColor: getJobStatusColor(status) }]} />
            </View>
            <View style={styles.statusBannerContent}>
              <Text style={[styles.statusBannerTitle, { color: getJobStatusColor(status) }]}>
                {JOB_STATUS_LABELS[status]}
              </Text>
              <Text style={[styles.statusBannerHint, { color: colors.textSecondary }]}>
                {startDate ? 'Scheduled — has start date' : 'Draft — add a schedule date to activate'}
              </Text>
            </View>
          </View>

          {/* ═══ DETAILS MEGA CARD ═══ */}
          <View style={[styles.megaCard, {backgroundColor: colors.surface}]}>

            {/* Section: Details */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="briefcase" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Details</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Job Title *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Kitchen Renovation"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Job details and notes..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

            {/* Section: Client & Location */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="users" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Client & Location</Text>
              </View>
              <View style={{gap: theme.spacing.sm}}>
                <AnimatedPressable
                  style={[styles.selectorRow, {borderColor: draftEstimate?.clientId ? colors.accent : colors.border, backgroundColor: draftEstimate?.clientId ? `${colors.accent}06` : colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
                  onPress={handleSelectClient}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="user" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Client</Text>
                    <Text
                      style={[styles.selectorValue, {color: draftEstimate?.clientId ? colors.text : colors.textSecondary}]}
                      numberOfLines={1}
                    >
                      {getClientName()}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                </AnimatedPressable>
                <AnimatedPressable
                  style={[
                    styles.selectorRow,
                    {borderColor: draftEstimate?.locationId ? colors.accent : colors.border, backgroundColor: draftEstimate?.locationId ? `${colors.accent}06` : colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md},
                    !draftEstimate?.clientId && {opacity: 0.4},
                  ]}
                  onPress={handleSelectLocation}
                  disabled={!draftEstimate?.clientId}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="map-pin" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Location</Text>
                    <Text
                      style={[styles.selectorValue, {color: draftEstimate?.locationId ? colors.text : colors.textSecondary}]}
                      numberOfLines={1}
                    >
                      {getLocationDisplay()}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                </AnimatedPressable>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

            {/* Section: Schedule */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="calendar" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Schedule</Text>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Start Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateDisplay,
                      {borderColor: colors.border, backgroundColor: colors.surface},
                      !startDate && {backgroundColor: `${colors.accent}08`, borderColor: colors.accent, borderStyle: 'dashed' as const},
                    ]}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <View style={[
                      styles.dateIconContainer,
                      { backgroundColor: `${colors.accent}15` },
                      startDate && { backgroundColor: colors.accent },
                    ]}>
                      <Icon
                        name="calendar"
                        size={14}
                        color={startDate ? '#FFFFFF' : colors.accent}
                      />
                    </View>
                    <Text style={[styles.dateText, {color: startDate ? colors.text : colors.textSecondary}, startDate && styles.dateTextFilled]}>
                      {startDate
                        ? startDate.toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true
                        })
                        : 'Tap to set date & time'
                      }
                    </Text>
                    {!startDate && (
                      <Icon name="plus" size={14} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.dateField}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>End Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateDisplay,
                      {borderColor: colors.border, backgroundColor: colors.surface},
                      !endDate && {backgroundColor: `${colors.accent}08`, borderColor: colors.accent, borderStyle: 'dashed' as const},
                    ]}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <View style={[
                      styles.dateIconContainer,
                      { backgroundColor: `${colors.accent}15` },
                      endDate && { backgroundColor: colors.accent },
                    ]}>
                      <Icon
                        name="calendar"
                        size={14}
                        color={endDate ? '#FFFFFF' : colors.accent}
                      />
                    </View>
                    <Text style={[styles.dateText, {color: endDate ? colors.text : colors.textSecondary}, endDate && styles.dateTextFilled]}>
                      {endDate
                        ? endDate.toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true
                        })
                        : 'Tap to set date & time'
                      }
                    </Text>
                    {!endDate && (
                      <Icon name="plus" size={14} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Calendar Pickers with Time Selection */}
              <CalendarPicker
                visible={showStartDatePicker}
                onClose={() => setShowStartDatePicker(false)}
                onSelectDate={(date) => setStartDate(date)}
                onClear={() => setStartDate(null)}
                selectedDate={startDate || undefined}
                minimumDate={new Date()}
                title="Start Date & Time"
                showTime={true}
              />
              <CalendarPicker
                visible={showEndDatePicker}
                onClose={() => setShowEndDatePicker(false)}
                onSelectDate={(date) => setEndDate(date)}
                onClear={() => setEndDate(null)}
                selectedDate={endDate || undefined}
                minimumDate={startDate || new Date()}
                title="End Date & Time"
                showTime={true}
              />

              {/* Recurrence */}
              <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />
              <RecurrencePicker
                isRecurring={editMode && currentJob ? currentJob.isRecurring : false}
                recurrenceRule={editMode && currentJob ? currentJob.recurrenceRule : undefined}
                onSave={(config) => setRecurrenceConfig(config)}
                occurrences={recurrenceOccurrences}
                loadingOccurrences={loadingOccurrences}
                onLoadOccurrences={async () => {
                  if (editMode && currentJob) {
                    setLoadingOccurrences(true);
                    try {
                      const result = await getOccurrences(currentJob.id, 20);
                      setRecurrenceOccurrences(result);
                    } finally {
                      setLoadingOccurrences(false);
                    }
                  }
                }}
              />

              {/* Billing Frequency - temporarily hidden from UI (read-only, not yet integrated with payments)
              {recurrenceConfig && (
                <>
                  <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />
                  <View style={{paddingVertical: 4}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8}}>
                      <View style={{width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.accent}15`}}>
                        <Icon name="dollar-sign" size={16} color={colors.accent} />
                      </View>
                      <Text style={[styles.sectionTitle, {color: colors.text, marginBottom: 0}]}>Billing Frequency</Text>
                    </View>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                      {(Object.keys(BILLING_FREQUENCY_LABELS) as BillingFrequency[]).map((key) => {
                        const isSelected = billingFrequency === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[
                              {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border},
                              isSelected && {backgroundColor: colors.accent, borderColor: colors.accent},
                            ]}
                            onPress={() => setBillingFrequency(isSelected ? null : key)}
                          >
                            <Text style={[
                              {fontSize: 13, fontWeight: '500', color: colors.text},
                              isSelected && {color: '#FFFFFF'},
                            ]}>{BILLING_FREQUENCY_LABELS[key]}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
              */}
            </View>
          </View>

          {/* Items Section - Same as CreateEstimateScreen */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeaderRow}
              onPress={() => setLineItemsExpanded(!lineItemsExpanded)}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Items</Text>
                {draftEstimate && draftEstimate.lineItems.length > 0 && (
                  <Text style={[styles.sectionBadge, {backgroundColor: `${colors.accent}20`, color: colors.accent}]}>{draftEstimate.lineItems.length} items</Text>
                )}
              </View>
              <Icon
                name={lineItemsExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {lineItemsExpanded && (
              <>
                {draftEstimate && draftEstimate.lineItems.length > 0 ? (
                  <>
                    {draftEstimate.lineItems.map((item, index) => (
                      <LineItemRow
                        key={item.id}
                        item={item as LineItemData}
                        index={index}
                        onUpdate={updateLineItem}
                        onRemove={removeLineItem}
                        categories={customCategories}
                        showCategory={false}
                        showMediaCount={true}
                        galleryMedia={draftEstimate.media || []}
                      />
                    ))}
                    {/* Inline Add Buttons */}
                    <View style={styles.inlineAddButtons}>
                      <TouchableOpacity
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddFromInventory}
                      >
                        <Icon name="package" size={20} color={colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddLaborItem}
                      >
                        <Icon name="clock" size={20} color={colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddLineItem}
                      >
                        <Icon name="plus" size={20} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={[styles.emptyLineItems, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <TouchableOpacity
                      style={styles.addLineItemButton}
                      onPress={handleAddFromInventory}
                    >
                      <Icon name="package" size={24} color={colors.textSecondary} />
                      <Text style={[styles.emptyLineItemsText, {color: colors.textSecondary}]}>
                        Tap here to add items
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Totals Summary - Same as Estimate */}
            {draftEstimate && draftEstimate.lineItems.length > 0 && (
              <View style={[styles.totalsCard, {backgroundColor: colors.surface}]}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Materials Cost</Text>
                  <Text style={[styles.totalCostValue, {color: colors.text}]}>
                    ${totals.materialsCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Materials Sell Price</Text>
                  <Text style={[styles.totalValue, {color: colors.text}]}>
                    ${totals.materialsSellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                {(totals.materialsSellPrice !== 0 || totals.materialsCost !== 0) && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.profitLabel, {color: colors.success}, totals.profit < 0 && {color: colors.error}]}>Profit</Text>
                    <Text style={[styles.profitValue, {color: colors.success}, totals.profit < 0 && {color: colors.error}]}>
                      {totals.profit >= 0 ? '+' : '-'}${Math.abs(totals.profit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                )}
                <View style={[styles.totalDivider, {backgroundColor: colors.divider}]} />
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Labor ({totals.laborHours} hrs)</Text>
                  <Text style={[styles.totalValue, {color: colors.text}]}>
                    ${totals.laborCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.totalDivider, {backgroundColor: colors.divider}]} />
                <View style={styles.totalRow}>
                  <Text style={[styles.grandTotalLabel, {color: colors.text}]}>Job Total</Text>
                  <Text style={[styles.grandTotalValue, {color: colors.accent}]}>
                    ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            )}
          </View>


          {/* Gallery Section - MOVED BEFORE GOALS */}
          {draftEstimate && (
            <View style={styles.section}>
              <EstimateGallery
                estimateId={editMode && currentJob ? currentJob.id : (draftEstimate.id || 'draft')}
                entityType={editMode ? 'job' : 'estimate'}
                estimate={editMode && currentJob ? {
                  media: (currentJob.media || []).map((m: any) => ({
                    ...m,
                    uri: m.webUrl || m.url || m.uri,
                    thumbnailUri: m.thumbUrl || m.thumbnailUrl || m.thumbnailUri,
                    type: m.type || (m.mimeType?.startsWith('video') ? 'video' : 'image'),
                    source: 'library' as const,
                  })),
                  albums: currentJob.albums || [],
                  lineItems: [],
                } : undefined}
              />
            </View>
          )}

          {/* Goals Section - Only in Edit Mode */}
          {editMode && currentJob && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, {color: colors.text}]}>Goals</Text>
              <GoalSection
                jobId={currentJob.id}
                readOnly={false}
              />
            </View>
          )}

          {/* Notes Section - Only in Edit Mode */}
          {editMode && currentJob && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Notes ({currentJob.notes?.length || 0})</Text>
                <TouchableOpacity
                  style={[styles.addNoteBtn, {backgroundColor: `${colors.accent}15`}]}
                  onPress={() => setShowNoteModal(true)}
                >
                  <Icon name="plus" size={16} color={colors.accent} />
                </TouchableOpacity>
              </View>

              <View style={[styles.card, {backgroundColor: colors.surface}]}>
                {(currentJob.notes?.length || 0) === 0 ? (
                  <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No notes yet.</Text>
                ) : (
                  (currentJob.notes || []).map(note => (
                    <View key={note.id} style={[styles.noteItem, {borderBottomColor: colors.divider}]}>
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
            </View>
          )}

        </ScrollView>

        {/* Save Button */}
        <View style={[styles.bottomBar, {backgroundColor: colors.surface, borderTopColor: colors.divider}]}>
          <Button
            title={isLoading ? (editMode ? 'Saving...' : 'Creating...') : (editMode ? 'Save Changes' : 'Create Job')}
            onPress={handleSave}
            loading={isLoading}
            disabled={!isValid}
          />
        </View>
      </KeyboardAvoidingView>

      <InventoryItemPicker
        visible={showInventoryPicker}
        onClose={() => setShowInventoryPicker(false)}
        items={inventoryItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          category: item.category,
        }))}
        selectedItems={[]}
        onConfirm={handleInventoryPickerConfirm}
        title="Add Items from Inventory"
        categories={customCategories}
        compact={true}
      />

      {/* Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.noteModalContent, {backgroundColor: colors.surface}]}>
            <Text style={[styles.noteModalTitle, {color: colors.text}]}>Add Note</Text>
            <TextInput
              style={[styles.noteInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
              value={noteContent}
              onChangeText={setNoteContent}
              placeholder="Type your note here..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.noteModalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowNoteModal(false)}
                disabled={noteLoading}
              />
              <Button
                title="Add Note"
                onPress={handleAddNote}
                loading={noteLoading}
                disabled={!noteContent.trim()}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView >
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
    paddingBottom: 100,
  },

  // Section
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },

  // Card
  card: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },

  // ── Mega Card ──
  megaCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  megaSection: {
    paddingVertical: theme.spacing.xs,
  },
  megaDivider: {
    height: StyleSheet.hairlineWidth,

    marginVertical: theme.spacing.sm,
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

  // Input
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing.xs,
  },
  textInput: {

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,

    borderWidth: 1,

  },
  textArea: {
    minHeight: 80,
    paddingTop: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },

  // Status Options
  statusOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  statusHint: {
    fontSize: theme.fontSize.xs,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Selector Row (like CreateEstimate)
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
  selectorPlaceholder: {
    fontWeight: theme.fontWeight.regular,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    marginVertical: theme.spacing.sm,
  },

  // Date Fields
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,

    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    minHeight: 52,
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

  // Info Note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  infoNoteText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },

  // Bottom Bar
  bottomBar: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionBadge: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },

  // Materials Empty State
  addMaterialsEmpty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  addMaterialsIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  addMaterialsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },

  // Notes
  noteItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  noteContent: {
    fontSize: theme.fontSize.md,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: theme.fontSize.xs,
  },
  addNoteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
  },

  // Modal
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
    borderWidth: 1,
  },
  noteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  addMaterialsSubtitle: {
    fontSize: theme.fontSize.sm,
  },

  // Material Row
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    marginBottom: 2,
  },
  materialMeta: {
    fontSize: theme.fontSize.sm,
  },
  materialRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Totals Card - Same as Estimate
  totalsCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    ...theme.shadow.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,

  },
  totalValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  totalCostValue: {
    fontSize: theme.fontSize.sm,

  },
  profitLabel: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  lossLabel: {
  },
  profitValue: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.semibold,
  },
  lossValue: {
  },
  totalDivider: {
    height: 1,

    marginVertical: theme.spacing.sm,
  },
  grandTotalLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  grandTotalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
  },

  // Add More Button
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  addMoreBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },

  // Line Items Section
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.full,
  },
  addNoteText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },

  // ── Sticky Bottom Bar ──
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : theme.spacing.md,
  },
  stickyBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyBarLeft: {
    gap: 2,
  },
  stickyBarLabel: {
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stickyBarTotal: {
    fontSize: 22,
    fontWeight: theme.fontWeight.bold,
  },
  stickyBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: theme.borderRadius.full,
  },
  stickyBarBtnText: {
    color: '#FFFFFF',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  inlineAddButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  inlineAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...theme.shadow.sm,
  },
  emptyLineItems: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addLineItemButton: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyLineItemsText: {
    fontSize: theme.fontSize.sm,
  },

  // ── Status Banner ──
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  statusBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusBannerContent: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
  },
  statusBannerHint: {
    fontSize: theme.fontSize.xs,
    marginTop: 1,
  },
});

export default CreateJobScreen;
