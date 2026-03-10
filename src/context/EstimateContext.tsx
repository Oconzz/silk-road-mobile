import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { estimateService } from '../services/api/domain/estimates/estimateService';
import { estimateTemplateService, type EstimateTemplateListItem } from '../services/api/domain/estimateTemplates/estimateTemplateService';
import type { EstimateTemplateRM } from '../types/apiResponses';
import { StorageService } from '../services/api/shared/utils';
import { useAuth } from './AuthContext';
import { haptics } from '../utils/haptics';
import type {
  CreateEstimateVM,
  UpdateEstimateVM,
  CreateEstimateItemVM,
} from '../types/apiRequests';
import type {
  EstimateRM,
  EstimateListItem,
} from '../types/apiResponses';
import type { InventoryItem } from '../types/navigation';
import { warehouseService } from '../services/api/domain/warehouse/warehouseService';

// Generate unique ID for draft items
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate a valid UUID v4
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface EstimateContextType {
  // Estimates
  estimates: EstimateListItem[];
  currentEstimate: EstimateRM | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  error: string | null;

  // Draft estimate (for creating/editing)
  draftEstimate: DraftEstimate | null;

  // Templates
  templates: EstimateTemplateListItem[];
  templatesLoading: boolean;
  loadTemplates: () => Promise<void>;
  getTemplate: (id: string) => Promise<EstimateTemplateRM | null>;
  saveAsTemplate: (estimateId: string, name: string, description?: string) => Promise<EstimateTemplateRM>;
  deleteTemplate: (id: string) => Promise<void>;

  // Clients (delegated to ClientContext but kept for backward compat)
  clients: any[];
  loadClients: () => void;

  // Actions - Estimates
  loadEstimates: (forceRefresh?: boolean) => Promise<void>;
  loadEstimate: (id: string) => Promise<void>;
  createEstimate: (data: CreateEstimateVM) => Promise<EstimateRM>;
  updateEstimate: (id: string, data: UpdateEstimateVM) => Promise<EstimateRM>;
  deleteEstimate: (id: string) => Promise<void>;
  convertToJob: (estimateId: string) => Promise<void>;
  sendToClient: (estimateId: string) => Promise<void>;
  markAsApproved: (estimateId: string) => Promise<void>;
  duplicateEstimate: (estimateId: string, newName?: string) => Promise<EstimateRM>;

  // Actions - Draft
  initDraft: (fromEstimate?: any, fromTemplate?: any) => void;
  initDraftForEdit: (estimate: any) => void;
  updateDraft: (updates: Partial<DraftEstimate>) => void;
  addLineItem: (item: DraftLineItem) => void;
  updateLineItem: (id: string, updates: Partial<DraftLineItem>) => void;
  removeLineItem: (id: string) => void;
  addFromInventory: (items: InventoryItem[]) => void;
  clearDraft: () => void;
  saveDraft: () => Promise<EstimateRM>;

  // Media (stub - not implemented in backend)
  addMedia: (media: any) => void;
  removeMedia: (mediaId: string) => Promise<void>;

  // Albums (stub - not implemented in backend)
  ensureDefaultAlbum: (estimateId?: string) => any;
  createAlbum: (name: string) => any;
  deleteAlbum: (albumId: string) => void;
  moveMediaToAlbum: (mediaId: string, albumId: string) => void;

  // Share link
  generateShareLink: (estimateId: string) => Promise<EstimateRM>;

  // Search and filter
  searchEstimates: (query: string) => Promise<EstimateListItem[]>;
  getEstimatesByClient: (clientId: string) => Promise<EstimateListItem[]>;

  // Computed
  draftTotalCost: number;
  draftTotalSellPrice: number;
  draftTotalLabor: number;
  draftTotalLaborCost: number;

  // Clear error
  clearError: () => void;
}

export interface DraftLineItem {
  id: string;
  productId?: string;
  warehouseId?: string;
  title: string;
  description: string;
  quantity: number;
  price: number;
  cost: number;
  labor: number;
  barcode?: string;
  source?: string;
  laborRate?: number;
  sellPrice?: number;
  type?: string;
  inventoryId?: string;
  mediaIds?: string[];
  category?: string;
}

export interface DraftEstimate {
  id?: string;
  name: string;
  description: string;
  estimateNumber?: string;
  clientId?: string;
  client?: any;
  locationId?: string;
  location?: any;
  lineItems: DraftLineItem[];
  termsAndConditions?: string;
  createdDate?: string;
  expirationDate?: string;
  proposedStartDate?: string;
  media?: any[];
  albums?: any[];
  isNew: boolean;
}

const EstimateContext = createContext<EstimateContextType | undefined>(undefined);

export const useEstimate = () => {
  const context = useContext(EstimateContext);
  if (!context) {
    throw new Error('useEstimate must be used within an EstimateProvider');
  }
  return context;
};

interface EstimateProviderProps {
  children: ReactNode;
}

export const EstimateProvider: React.FC<EstimateProviderProps> = ({ children }) => {
  const { isAuthenticated, currentCompany } = useAuth();
  const [estimates, setEstimates] = useState<EstimateListItem[]>([]);
  const [currentEstimate, setCurrentEstimate] = useState<EstimateRM | null>(null);
  const [draftEstimate, setDraftEstimate] = useState<DraftEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Use company-specific cache key for data isolation
  const cacheKey = currentCompany?.companyId
    ? `@nmj_${currentCompany.companyId}_estimates`
    : '@nmj_default_estimates';

  // Clear state when company changes to prevent data leaking between accounts
  useEffect(() => {
    setEstimates([]);
    setCurrentEstimate(null);
    setError(null);
  }, [currentCompany?.companyId]);

  // Load estimates from backend or cache
  const loadEstimates = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated || !currentCompany) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      if (!forceRefresh) {
        const cached = await StorageService.getData<EstimateListItem[]>(cacheKey);
        if (cached && cached.length > 0) {
          setEstimates(cached);
        }
      }

      // Fetch from backend
      const response = await estimateService.getEstimateList({
        pageSize: 100,
      });

      const data = response?.items || [];
      setEstimates(data);

      // Always update cache with current data (even if empty)
      await StorageService.setData(cacheKey, data);
    } catch (err: any) {
      console.error('Error loading estimates:', err);
      setError(err.message || 'Failed to load estimates');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentCompany, cacheKey]);

  // Load single estimate
  const loadEstimate = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const estimate = await estimateService.getEstimateById(id);

      // Map items to lineItems for frontend compatibility
      // Backend returns 'items', frontend expects 'lineItems'
      const mappedEstimate = {
        ...estimate,
        lineItems: estimate.items?.map(item => ({
          ...item,
          id: item.id || `item-${Date.now()}-${Math.random()}`,
          title: item.title || item.description,
          description: item.description || item.title,
          sellPrice: item.price,
          cost: item.price,
          type: item.labor && item.labor > 0 ? 'labor' : 'material',
          laborRate: item.labor && item.labor > 0 ? item.price / item.labor : 0,
        })) || [],
        // Map media to ensuring uri is present (backend uses webUrl/thumbUrl)
        media: (estimate.media || []).map((m: any) => ({
          ...m,
          uri: m.webUrl || m.url || m.uri,
          thumbnailUri: m.thumbUrl || m.thumbnailUrl || m.thumbnailUri,
        })),
      };

      setCurrentEstimate(mappedEstimate);
    } catch (err: any) {
      console.error('Error loading estimate:', err);
      setError(err.message || 'Failed to load estimate');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create estimate
  const createEstimate = useCallback(async (data: CreateEstimateVM): Promise<EstimateRM> => {
    try {
      setLoading(true);
      setError(null);

      const newEstimate = await estimateService.createEstimate(data);

      // Haptic feedback on success
      haptics.success();

      // Refresh the list
      await loadEstimates(true);

      return newEstimate;
    } catch (err: any) {
      console.error('Error creating estimate:', err);
      setError(err.message || 'Failed to create estimate');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadEstimates]);

  // Update estimate
  const updateEstimate = useCallback(async (
    id: string,
    data: UpdateEstimateVM
  ): Promise<EstimateRM> => {
    try {
      setLoading(true);
      setError(null);

      const updatedEstimate = await estimateService.updateEstimate({
        ...data,
        id,
      });

      // Refresh the list
      await loadEstimates(true);

      // Update current estimate if it's the one being updated
      if (currentEstimate?.id === id) {
        setCurrentEstimate(updatedEstimate);
      }

      return updatedEstimate;
    } catch (err: any) {
      console.error('Error updating estimate:', err);
      setError(err.message || 'Failed to update estimate');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadEstimates, currentEstimate]);

  // Delete estimate
  const deleteEstimate = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await estimateService.deleteEstimate(id);

      // Remove from local state
      setEstimates(prev => prev.filter(e => e.id !== id));

      // Clear current estimate if it's the one being deleted
      if (currentEstimate?.id === id) {
        setCurrentEstimate(null);
      }

      // Update cache
      const updatedEstimates = estimates.filter(e => e.id !== id);
      await StorageService.setData(cacheKey, updatedEstimates);
    } catch (err: any) {
      console.error('Error deleting estimate:', err);
      setError(err.message || 'Failed to delete estimate');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [estimates, currentEstimate, cacheKey]);

  // Convert to job
  const convertToJob = useCallback(async (estimateId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await estimateService.convertToJob({ estimateId });

      // Mark estimate as approved
      await estimateService.markAsApproved(estimateId);

      // Refresh the list
      await loadEstimates(true);
    } catch (err: any) {
      console.error('Error converting estimate to job:', err);
      setError(err.message || 'Failed to convert estimate to job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadEstimates]);

  // Send to client
  const sendToClient = useCallback(async (estimateId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await estimateService.sendToClient(estimateId);

      // Refresh the list
      await loadEstimates(true);
    } catch (err: any) {
      console.error('Error sending estimate:', err);
      setError(err.message || 'Failed to send estimate');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadEstimates]);

  // Mark as approved
  const markAsApproved = useCallback(async (estimateId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await estimateService.markAsApproved(estimateId);

      // Refresh the list
      await loadEstimates(true);
    } catch (err: any) {
      console.error('Error approving estimate:', err);
      setError(err.message || 'Failed to approve estimate');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadEstimates]);

  // Duplicate estimate
  const duplicateEstimate = useCallback(async (
    estimateId: string,
    newName?: string
  ): Promise<EstimateRM> => {
    try {
      setLoading(true);
      setError(null);

      const duplicate = await estimateService.duplicateEstimate(estimateId, newName);

      // Refresh the list
      await loadEstimates(true);

      return duplicate;
    } catch (err: any) {
      console.error('Error duplicating estimate:', err);
      setError(err.message || 'Failed to duplicate estimate');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadEstimates]);

  // Generate share link
  const generateShareLink = useCallback(async (estimateId: string): Promise<EstimateRM> => {
    try {
      console.log('[EstimateContext] Generating share link for estimate:', estimateId);
      const updated = await estimateService.generateShareLink(estimateId);
      // Update current estimate if it matches
      if (currentEstimate?.id === estimateId) {
        setCurrentEstimate(updated);
      }
      return updated;
    } catch (err: any) {
      console.error('[EstimateContext] Error generating share link:', err);
      setError(err.message || 'Failed to generate share link');
      throw err;
    }
  }, [currentEstimate]);

  // Search estimates
  const searchEstimates = useCallback(async (query: string): Promise<EstimateListItem[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await estimateService.searchEstimates(query);
      return results;
    } catch (err: any) {
      console.error('Error searching estimates:', err);
      setError(err.message || 'Failed to search estimates');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get estimates by client
  const getEstimatesByClient = useCallback(async (clientId: string): Promise<EstimateListItem[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await estimateService.getEstimatesByClient(clientId);
      return results;
    } catch (err: any) {
      console.error('Error fetching estimates by client:', err);
      setError(err.message || 'Failed to fetch estimates by client');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize draft
  const initDraft = useCallback((fromEstimate?: EstimateRM) => {
    console.log('[EstimateContext] initDraft called, fromEstimate:', fromEstimate ? 'provided' : 'undefined');
    if (fromEstimate) {
      setDraftEstimate({
        name: fromEstimate.name,
        description: fromEstimate.description || '',
        clientId: fromEstimate.client?.id,
        locationId: fromEstimate.location?.id,
        lineItems: (fromEstimate.items || []).map(item => ({
          id: item.id,
          productId: item.productId,
          warehouseId: item.warehouseId,
          title: item.title || item.description,
          description: item.description,
          quantity: item.quantity,
          price: item.price || item.cost,
          cost: item.cost,
          labor: item.labor || 0,
          barcode: item.barcode,
          source: item.source,
          mediaIds: item.mediaIds,
        })),
        termsAndConditions: fromEstimate.termsAndConditions,
        isNew: true,
      });
      console.log('[EstimateContext] initDraft - set from estimate with', fromEstimate.items?.length, 'items');
    } else {
      setDraftEstimate({
        name: '',
        description: '',
        lineItems: [],
        isNew: true,
      });
      console.log('[EstimateContext] initDraft - set empty draft');
    }
  }, []);

  // Initialize draft for edit
  const initDraftForEdit = useCallback((estimate: EstimateRM) => {
    setDraftEstimate({
      id: estimate.id,
      name: estimate.name,
      description: estimate.description || '',
      clientId: estimate.client?.id,
      locationId: estimate.location?.id,
      lineItems: estimate.items.map(item => {
        const isLaborItem = item.labor > 0 && (!item.title || item.title.toLowerCase().includes('labor'));
        const sellPrice = item.price || item.cost || 0;
        const laborRate = isLaborItem && item.labor > 0 ? (item.price / item.labor) : (item.laborRate || 0);
        return {
          id: item.id,
          productId: item.productId,
          warehouseId: item.warehouseId,
          inventoryId: item.inventoryId,
          title: item.title || item.description,
          description: item.description,
          quantity: item.quantity,
          price: sellPrice,
          sellPrice: sellPrice,
          cost: item.cost || 0,
          labor: item.labor || 0,
          laborRate: laborRate,
          type: isLaborItem ? 'labor' : 'material',
          barcode: item.barcode,
          source: item.source,
          category: item.category,
          mediaIds: item.mediaIds,
        };
      }),
      termsAndConditions: estimate.termsAndConditions,
      // Copy media and albums for gallery display in edit mode
      media: estimate.media || [],
      albums: estimate.albums || [],
      isNew: false,
    });
  }, []);

  // Update draft - creates a new draft if none exists
  const updateDraft = useCallback((updates: Partial<DraftEstimate>) => {
    setDraftEstimate(prev => {
      if (prev) {
        return { ...prev, ...updates };
      }
      // If no draft exists, create a new one with the updates
      console.log('[EstimateContext] updateDraft - creating new draft with updates');
      return {
        name: '',
        description: '',
        lineItems: [],
        isNew: true,
        ...updates,
      };
    });
  }, []);

  // Add line item
  const addLineItem = useCallback((item: DraftLineItem) => {
    console.log('[EstimateContext] addLineItem called with:', item);
    setDraftEstimate(prev => {
      console.log('[EstimateContext] addLineItem - prev draftEstimate:', prev ? { lineItemsCount: prev.lineItems?.length } : 'null');
      if (!prev) {
        console.warn('[EstimateContext] addLineItem - draftEstimate is null, cannot add item!');
        return null;
      }
      const newLineItems = [...prev.lineItems, { ...item, id: item.id || generateId() }];
      console.log('[EstimateContext] addLineItem - new lineItems count:', newLineItems.length);
      return {
        ...prev,
        lineItems: newLineItems,
      };
    });
  }, []);

  // Update line item
  const updateLineItem = useCallback((id: string, updates: Partial<DraftLineItem>) => {
    setDraftEstimate(prev => {
      if (!prev) return null;

      // Sync sellPrice and price fields
      const syncedUpdates = { ...updates };
      if ('sellPrice' in updates && updates.sellPrice !== undefined) {
        syncedUpdates.price = updates.sellPrice;
      }
      if ('price' in updates && updates.price !== undefined) {
        syncedUpdates.sellPrice = updates.price;
      }

      return {
        ...prev,
        lineItems: prev.lineItems.map(item =>
          item.id === id ? { ...item, ...syncedUpdates } : item
        ),
      };
    });
  }, []);

  // Remove line item
  const removeLineItem = useCallback((id: string) => {
    setDraftEstimate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        lineItems: prev.lineItems.filter(item => item.id !== id),
      };
    });
  }, []);

  // Add from inventory
  const addFromInventory = useCallback((items: InventoryItem[]) => {
    setDraftEstimate(prev => {
      if (!prev) return null;

      const newItems: DraftLineItem[] = items.map(item => ({
        id: generateId(),
        productId: generateUUID(),
        title: item.name || item.description || '',
        description: item.description || item.name || '',
        quantity: 1,
        price: item.price || 0,
        cost: item.price || 0,
        labor: 0,
        inventoryId: item.id,
      }));

      return {
        ...prev,
        lineItems: [...prev.lineItems, ...newItems],
      };
    });
  }, []);

  // Clear draft
  const clearDraft = useCallback(() => {
    setDraftEstimate(null);
  }, []);

  // Save draft
  const saveDraft = useCallback(async (): Promise<EstimateRM> => {
    if (!draftEstimate) {
      throw new Error('No draft to save');
    }

    // Prevent concurrent saves
    if (isSaving) {
      console.warn('[EstimateContext] Save already in progress, skipping');
      throw new Error('Save already in progress');
    }

    try {
      setIsSaving(true);

      // Always get the current company's default warehouse to ensure data integrity
      // This prevents using stale warehouseIds from cached data
      let defaultWarehouseId: string | undefined;
      try {
        const warehouse = await warehouseService.getOrCreateDefaultWarehouse();
        defaultWarehouseId = warehouse.id;
      } catch (err) {
        console.error('[EstimateContext] Error getting default warehouse:', err);
      }

      // Build items WITHOUT mediaIds first (will add after media registration)
      const items: CreateEstimateItemVM[] = draftEstimate.lineItems.map(item => ({
        productId: item.productId || generateUUID(),
        warehouseId: defaultWarehouseId || generateUUID(),
        inventoryId: item.inventoryId,
        title: item.title || item.description,
        description: item.description,
        quantity: item.quantity,
        price: item.price || item.cost,
        labor: item.labor || 0,
        barcode: item.barcode,
        source: item.source,
      }));

      // Collect local media that needs backend registration
      const localMedia = (draftEstimate.media || []).filter(
        (m: any) => (m.isLocal || m.id?.startsWith('temp-')) && m.s3Key
      );
      // Check if any line items have media links
      const hasMediaLinks = draftEstimate.lineItems.some(
        item => item.mediaIds && item.mediaIds.length > 0
      );

      console.log('[EstimateContext] saveDraft - localMedia:', localMedia.length, 'hasMediaLinks:', hasMediaLinks);

      // Helper: Register local media in backend and build ID mapping
      const registerLocalMedia = async (estimateId: string): Promise<Record<string, string>> => {
        const mapping: Record<string, string> = {};
        for (const media of localMedia) {
          try {
            const backendMedia = await estimateService.addMedia({
              estimateId,
              s3Key: (media as any).s3Key,
              type: media.type === 'video' ? 'video' : 'photo',
              fileName: media.fileName || `media-${Date.now()}.jpg`,
              mimeType: media.mimeType || 'image/jpeg',
              sizeBytes: media.sizeBytes || 0,
              albumId: media.albumId && media.albumId !== 'default-overview' ? media.albumId : undefined,
            });
            mapping[media.id] = backendMedia.id;
            console.log('[EstimateContext] Registered media:', media.id, '->', backendMedia.id);
          } catch (err) {
            console.error('[EstimateContext] Failed to register media:', media.id, err);
          }
        }
        return mapping;
      };

      // Helper: Build items with translated mediaIds
      const buildItemsWithMediaIds = (mediaMapping: Record<string, string>): CreateEstimateItemVM[] => {
        return draftEstimate.lineItems.map(item => ({
          productId: item.productId || generateUUID(),
          warehouseId: defaultWarehouseId || generateUUID(),
          inventoryId: item.inventoryId,
          title: item.title || item.description,
          description: item.description,
          quantity: item.quantity,
          price: item.price || item.cost,
          labor: item.labor || 0,
          barcode: item.barcode,
          source: item.source,
          mediaIds: item.mediaIds
            ?.map(localId => mediaMapping[localId])
            .filter((id): id is string => !!id),
        }));
      };

      if (draftEstimate.id && !draftEstimate.isNew) {
        // === UPDATE existing estimate ===
        if (localMedia.length > 0) {
          // Register any new local media first
          const mediaMapping = await registerLocalMedia(draftEstimate.id);

          if (hasMediaLinks && Object.keys(mediaMapping).length > 0) {
            // Update with translated mediaIds
            const itemsWithMedia = buildItemsWithMediaIds(mediaMapping);
            const updated = await updateEstimate(draftEstimate.id, {
              name: draftEstimate.name,
              description: draftEstimate.description,
              clientId: draftEstimate.clientId,
              locationId: draftEstimate.locationId,
              proposedStartDate: draftEstimate.proposedStartDate,
              expirationDate: draftEstimate.expirationDate,
              termsAndConditions: draftEstimate.termsAndConditions,
              items: itemsWithMedia,
              id: draftEstimate.id,
            });
            clearDraft();
            return updated;
          }
        }

        // No local media or no links - update normally (with existing backend mediaIds if any)
        const itemsForUpdate = hasMediaLinks
          ? draftEstimate.lineItems.map(item => ({
              productId: item.productId || generateUUID(),
              warehouseId: defaultWarehouseId || generateUUID(),
              inventoryId: item.inventoryId,
              title: item.title || item.description,
              description: item.description,
              quantity: item.quantity,
              price: item.price || item.cost,
              labor: item.labor || 0,
              barcode: item.barcode,
              source: item.source,
              // Pass through mediaIds that are already valid backend GUIDs
              mediaIds: item.mediaIds?.filter(id => !id.startsWith('temp-')),
            }))
          : items;

        const updated = await updateEstimate(draftEstimate.id, {
          name: draftEstimate.name,
          description: draftEstimate.description,
          clientId: draftEstimate.clientId,
          locationId: draftEstimate.locationId,
          proposedStartDate: draftEstimate.proposedStartDate,
          expirationDate: draftEstimate.expirationDate,
          termsAndConditions: draftEstimate.termsAndConditions,
          items: itemsForUpdate,
          id: draftEstimate.id,
        });

        clearDraft();
        return updated;
      } else {
        // === CREATE new estimate ===
        // Step 1: Create estimate with items (no mediaIds yet)
        const created = await createEstimate({
          name: draftEstimate.name,
          description: draftEstimate.description,
          clientId: draftEstimate.clientId,
          locationId: draftEstimate.locationId,
          proposedStartDate: draftEstimate.proposedStartDate,
          expirationDate: draftEstimate.expirationDate,
          items,
          termsAndConditions: draftEstimate.termsAndConditions,
        });

        // Step 2: Register local media in backend and link to line items
        if (localMedia.length > 0) {
          const mediaMapping = await registerLocalMedia(created.id);
          console.log('[EstimateContext] Media mapping:', mediaMapping);

          // Step 3: If line items have media links, update estimate with translated mediaIds
          if (hasMediaLinks && Object.keys(mediaMapping).length > 0) {
            try {
              const itemsWithMedia = buildItemsWithMediaIds(mediaMapping);
              const updatedWithMedia = await updateEstimate(created.id, {
                name: created.name,
                items: itemsWithMedia,
                id: created.id,
              });
              clearDraft();
              return updatedWithMedia;
            } catch (err) {
              console.error('[EstimateContext] Failed to update media links, estimate still created:', err);
            }
          }
        }

        clearDraft();
        return created;
      }
    } finally {
      setIsSaving(false);
    }
  }, [draftEstimate, createEstimate, updateEstimate, clearDraft, isSaving]);

  // Computed values
  const draftTotalCost = useMemo(() => {
    if (!draftEstimate) return 0;
    return draftEstimate.lineItems.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
  }, [draftEstimate]);

  const draftTotalSellPrice = useMemo(() => {
    if (!draftEstimate) return 0;
    // Use price (sell price) for total - do NOT fallback to cost
    return draftEstimate.lineItems.reduce((sum, item) => {
      const sellPrice = item.price || item.sellPrice || 0;
      return sum + (sellPrice * item.quantity);
    }, 0);
  }, [draftEstimate]);

  const draftTotalLabor = useMemo(() => {
    if (!draftEstimate) return 0;
    return draftEstimate.lineItems.reduce((sum, item) => sum + (item.labor || 0), 0);
  }, [draftEstimate]);

  const draftTotalLaborCost = useMemo(() => {
    if (!draftEstimate) return 0;
    return draftEstimate.lineItems.reduce((sum, item) => {
      // No default rate - if laborRate is not set, cost is 0
      const laborRate = item.laborRate || 0;
      return sum + ((item.labor || 0) * laborRate);
    }, 0);
  }, [draftEstimate]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Templates implementation
  const [templates, setTemplates] = useState<EstimateTemplateListItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!isAuthenticated || !currentCompany?.companyId) return;

    try {
      setTemplatesLoading(true);
      const response = await estimateTemplateService.list({ pageSize: 100 });
      setTemplates(response.items || []);
    } catch (err: any) {
      console.error('[EstimateContext] Error loading templates:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, [isAuthenticated, currentCompany?.companyId]);

  const getTemplate = useCallback(async (id: string): Promise<EstimateTemplateRM | null> => {
    try {
      const template = await estimateTemplateService.getById(id);
      return template;
    } catch (err: any) {
      console.error('[EstimateContext] Error getting template:', err);
      return null;
    }
  }, []);

  const saveAsTemplate = useCallback(async (estimateId: string, name: string, description?: string): Promise<EstimateTemplateRM> => {
    try {
      setLoading(true);
      const template = await estimateTemplateService.createFromEstimate(estimateId, name, description);
      // Reload templates list
      await loadTemplates();
      return template;
    } catch (err: any) {
      console.error('[EstimateContext] Error saving template:', err);
      setError(err.message || 'Failed to save template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadTemplates]);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      await estimateTemplateService.delete(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      console.error('[EstimateContext] Error deleting template:', err);
      setError(err.message || 'Failed to delete template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Stub for clients (use ClientContext instead)
  const clients: any[] = [];
  const loadClientsStub = useCallback(() => {
    console.warn('Use ClientContext.loadClients instead');
  }, []);

  // Media implementation
  const addMedia = useCallback(async (media: any) => {
    if (!draftEstimate) return;

    // If no valid ID (draft mode), add media locally without API call
    const isValidId = draftEstimate.id && draftEstimate.id !== 'draft' && draftEstimate.id.length > 10;
    
    if (!isValidId) {
      // Local mode: add media to draft state with temporary ID
      const localMedia = {
        ...media,
        id: media.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        uri: media.uri,
        thumbnailUri: media.thumbnailUri,
        isLocal: true, // Flag to identify local media not yet uploaded
      };

      setDraftEstimate(prev => {
        if (!prev) return null;
        return { ...prev, media: [...(prev.media || []), localMedia] };
      });
      return;
    }

    // API mode: upload to backend
    try {
      setLoading(true);
      const addedMedia = await estimateService.addMedia({
        estimateId: draftEstimate.id!, // Safe: isValidId check above ensures this exists
        s3Key: media.s3Key,
        fileName: media.fileName,
        type: media.type,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        albumId: media.albumId,
      });

      // Map the response to ensure uri is present (backend uses webUrl/thumbUrl)
      const mappedMedia = {
        ...addedMedia,
        uri: (addedMedia as any).webUrl || addedMedia.url || (addedMedia as any).uri,
        thumbnailUri: (addedMedia as any).thumbUrl || addedMedia.thumbnailUrl || (addedMedia as any).thumbnailUri,
      };

      setDraftEstimate(prev => {
        if (!prev) return null;
        return { ...prev, media: [...(prev.media || []), mappedMedia] };
      });
    } catch (err: any) {
      console.error('Error adding media:', err);
      setError(err.message || 'Failed to add media');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEstimate?.id, draftEstimate?.isNew]);

  const removeMedia = useCallback(async (mediaId: string) => {
    if (!draftEstimate) return;

    // Check if this is local media (not yet uploaded to backend)
    const mediaToRemove = (draftEstimate.media || []).find((m: any) => m.id === mediaId);
    const isLocalMedia = mediaToRemove?.isLocal || mediaId.startsWith('temp-');

    if (isLocalMedia) {
      // Local mode: just remove from state
      setDraftEstimate(prev => {
        if (!prev) return null;
        return { ...prev, media: (prev.media || []).filter((m: any) => m.id !== mediaId) };
      });
      return;
    }

    // API mode: delete from backend
    try {
      setLoading(true);
      await estimateService.removeMedia(mediaId);

      setDraftEstimate(prev => {
        if (!prev) return null;
        return { ...prev, media: (prev.media || []).filter((m: any) => m.id !== mediaId) };
      });
    } catch (err: any) {
      console.error('Error removing media:', err);
      setError(err.message || 'Failed to remove media');
    } finally {
      setLoading(false);
    }
  }, [draftEstimate]);

  // Stub for albums (not implemented in backend)
  const ensureDefaultAlbum = useCallback((_estimateId?: string) => {
    return { id: 'default', name: 'Default Album', mediaIds: [] };
  }, []);
  const createAlbum = useCallback((name: string) => {
    const newAlbum = { id: generateId(), name, mediaIds: [] };
    setDraftEstimate(prev => {
      if (!prev) return null;
      return { ...prev, albums: [...(prev.albums || []), newAlbum] };
    });
    return newAlbum;
  }, []);
  const deleteAlbum = useCallback((_albumId: string) => {
    setDraftEstimate(prev => {
      if (!prev) return null;
      return { ...prev, albums: (prev.albums || []).filter((a: any) => a.id !== _albumId) };
    });
  }, []);
  const moveMediaToAlbum = useCallback((_mediaId: string, _albumId: string) => {
    console.log('moveMediaToAlbum - stub implementation');
  }, []);

  // Load estimates on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      loadEstimates();
    }
  }, [isAuthenticated, currentCompany, loadEstimates]);

  const value: EstimateContextType = {
    estimates,
    currentEstimate,
    loading,
    isLoading: loading,
    error,
    draftEstimate,
    // Templates
    templates,
    templatesLoading,
    loadTemplates,
    getTemplate,
    saveAsTemplate,
    deleteTemplate,
    // Clients stub
    clients,
    loadClients: loadClientsStub,
    // Actions
    loadEstimates,
    loadEstimate,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    convertToJob,
    sendToClient,
    markAsApproved,
    duplicateEstimate,
    initDraft,
    initDraftForEdit,
    updateDraft,
    addLineItem,
    updateLineItem,
    removeLineItem,
    addFromInventory,
    clearDraft,
    saveDraft,
    // Media stub
    addMedia,
    removeMedia,
    // Albums stub
    ensureDefaultAlbum,
    createAlbum,
    deleteAlbum,
    moveMediaToAlbum,
    // Share link
    generateShareLink,
    // Search
    searchEstimates,
    getEstimatesByClient,
    // Computed
    draftTotalCost,
    draftTotalSellPrice,
    draftTotalLabor,
    draftTotalLaborCost,
    clearError,
  };

  return (
    <EstimateContext.Provider value={value}>
      {children}
    </EstimateContext.Provider>
  );
};
