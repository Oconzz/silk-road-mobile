import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inventoryService } from '../services/api/domain/inventory/inventoryService';
import { inventoryCategoryService } from '../services/api/domain/inventory/inventoryCategoryService';
import { warehouseService } from '../services/api/domain/warehouse/warehouseService';
// import { StorageService } from '../services/api/shared/utils';
import { useAuth } from './AuthContext';
import type { InventoryItem } from '../types/navigation';
import type {
  CreateInventoryVM,
  UpdateInventoryVM,
} from '../types/apiRequests';
import type {
  InventoryRM,
  InventoryListItem,
  WarehouseListItem,
} from '../types/apiResponses';

interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

interface InventoryContextType {
  // State
  items: InventoryItem[];
  isLoading: boolean;
  error: string | null;
  
  // Warehouse
  currentWarehouseId: string | null;
  warehouses: WarehouseListItem[];
  setCurrentWarehouse: (warehouseId: string) => Promise<void>;
  loadWarehouses: () => Promise<void>;
  
  // CRUD operations
  loadItems: (refresh?: boolean) => Promise<void>;
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  addItems: (items: Omit<InventoryItem, 'id'>[]) => Promise<void>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearInventory: () => Promise<void>;
  getItemByBarcode: (barcode: string) => InventoryItem | undefined;

  // Computed values
  totalItems: number;
  totalValue: number;

  // Custom categories (local only)
  customCategories: CustomCategory[];
  addCategory: (name: string, color?: string) => CustomCategory;
  updateCategory: (id: string, updates: Partial<CustomCategory>) => void;
  removeCategory: (id: string) => void;

  // Search and filter
  searchItems: (query: string) => InventoryItem[];
  filterByCategory: (category: string) => InventoryItem[];
  
  // Refresh
  refreshAll: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined,
);

interface InventoryProviderProps {
  children: ReactNode;
}

// Storage keys - now dynamic based on companyId for data isolation
const getStorageKeys = (companyId: string | null) => {
  const prefix = companyId ? `@nmj_${companyId}` : '@nmj_default';
  return {
    ITEMS: `${prefix}_inventory_items`,
    CATEGORIES: `${prefix}_inventory_categories`,
    LAST_SYNC: `${prefix}_inventory_last_sync`,
  };
};

// Default category colors
const CATEGORY_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

// Generate a valid UUID v4
const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper to convert API response to local InventoryItem
const mapFromAPI = (apiItem: InventoryRM | InventoryListItem): InventoryItem => {
  // For InventoryListItem (grouped by product), get the first warehouse detail's inventoryId
  const isListItem = 'warehouseDetails' in apiItem;
  const firstWarehouse = isListItem ? apiItem.warehouseDetails?.[0] : null;

  return {
    // Use inventoryId from warehouseDetails if available, otherwise use id or productId
    // Check if id is truthy (not just present) because InventoryListItem has id: null
    id: ('id' in apiItem && apiItem.id) ? apiItem.id : (firstWarehouse?.inventoryId || apiItem.productId),
    name: apiItem.title,
    title: apiItem.title,
    description: apiItem.description,
    quantity: 'quantity' in apiItem ? apiItem.quantity : apiItem.totalQuantity,
    price: Number(apiItem.price),
    barcode: apiItem.barcode || undefined,
    // Preserve productId and warehouseId for backend operations
    productId: apiItem.productId,
    warehouseId: 'warehouseId' in apiItem ? apiItem.warehouseId : firstWarehouse?.warehouseId,
    category: 'category' in apiItem ? apiItem.category : undefined,
    imageS3Key: apiItem.imageS3Key || undefined,
    tags: [],
    purchaseDate: undefined,
    store: undefined,
    returnDeadline: undefined,
  };
};

// Helper to convert local InventoryItem to API request
const mapToAPI = (item: Omit<InventoryItem, 'id'>, warehouseId: string): CreateInventoryVM => {
  return {
    productId: generateId(), // Using generated ID as productId
    warehouseId: warehouseId,
    quantity: item.quantity,
    price: item.price,
    title: item.name,
    description: item.description,
    barcode: item.barcode,
    imageS3Key: item.imageS3Key,
    category: item.category,
    source: item.store,
  };
};

export const InventoryProvider: React.FC<InventoryProviderProps> = ({
  children,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
  const { isAuthenticated, currentCompany } = useAuth();

  const initializeWarehouse = async () => {
    if (defaultWarehouseId) return; // Already initialized

    try {
      console.log('[InventoryContext] Initializing default warehouse');
      const warehouse = await warehouseService.getOrCreateDefaultWarehouse();
      setDefaultWarehouseId(warehouse.id);
      console.log('[InventoryContext] Default warehouse set:', warehouse.id);
    } catch (error) {
      console.error('[InventoryContext] Error initializing warehouse:', error);
    }
  };

  const loadWarehouses = useCallback(async () => {
    if (!isAuthenticated || !currentCompany) return;
    try {
      const response = await warehouseService.getWarehouseList({ pageSize: 100 });
      setWarehouses(response.items || []);
    } catch (error) {
      console.error('[InventoryContext] Error loading warehouses:', error);
    }
  }, [isAuthenticated, currentCompany]);

  const setCurrentWarehouse = useCallback(async (warehouseId: string) => {
    setDefaultWarehouseId(warehouseId);
    // Reload items for the new warehouse
    setIsLoading(true);
    try {
      const response = await inventoryService.getInventoryList({
        pageNumber: 1,
        pageSize: 100,
        warehouseId,
      });
      const mappedItems = (response.items || []).map(mapFromAPI);
      setItems(mappedItems);
    } catch (error) {
      console.error('[InventoryContext] Error loading items for warehouse:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStoredData = async () => {
    const storageKeys = getStorageKeys(currentCompany?.companyId || null);
    try {
      const [itemsStr, categoriesStr] = await Promise.all([
        AsyncStorage.getItem(storageKeys.ITEMS),
        AsyncStorage.getItem(storageKeys.CATEGORIES),
      ]);

      if (itemsStr) {
        const savedItems = JSON.parse(itemsStr);
        setItems(savedItems);
      }

      if (categoriesStr) {
        const savedCategories = JSON.parse(categoriesStr);
        setCustomCategories(savedCategories);
      }
    } catch (error) {
      console.error('Error loading stored inventory data:', error);
    }
  };

  const storeItems = async (itemsToStore: InventoryItem[]) => {
    const storageKeys = getStorageKeys(currentCompany?.companyId || null);
    try {
      await AsyncStorage.setItem(storageKeys.ITEMS, JSON.stringify(itemsToStore));
      await AsyncStorage.setItem(storageKeys.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error storing items:', error);
    }
  };

  const loadItems = async (refresh = false) => {
    if (!isAuthenticated || !currentCompany) return;

    setIsLoading(true);
    setError(null);

    try {
      // If refresh, force API call
      if (refresh) {
        const response = await inventoryService.getInventoryList({
          pageNumber: 1,
          pageSize: 100, // Adjust based on expected volume
        });

        const data = response?.items || [];
        const mappedItems = data.map(mapFromAPI);
        setItems(mappedItems);
        if (mappedItems.length > 0) {
          await storeItems(mappedItems);
        }
      } else {
        // Try to load from storage first
        const storageKeys = getStorageKeys(currentCompany?.companyId || null);
        const lastSync = await AsyncStorage.getItem(storageKeys.LAST_SYNC);
        const now = new Date();
        const syncDate = lastSync ? new Date(lastSync) : null;

        // If data is older than 5 minutes, refresh
        if (!syncDate || now.getTime() - syncDate.getTime() > 5 * 60 * 1000) {
          await loadItems(true);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load inventory');
      console.error('Error loading items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (item: Omit<InventoryItem, 'id'>) => {
    let newItem: InventoryItem | null = null;
    try {
      // Add to local state immediately for optimistic UI
      newItem = {
        ...item,
        id: generateId(),
      };
      setItems(prev => [...prev, newItem!]);

      // Try to sync with API if authenticated
      if (isAuthenticated && currentCompany && defaultWarehouseId) {
        const apiData = mapToAPI(item, defaultWarehouseId);
        await inventoryService.createInventory(apiData);

        // Refresh items to get server-generated IDs
        await loadItems(true);
      } else {
        // Just store locally if not authenticated
        await storeItems([...items, newItem]);
      }
    } catch (error: any) {
      // Rollback on error
      if (newItem) {
        setItems(prev => prev.filter(i => i.id !== newItem!.id));
      }
      setError(error.message || 'Failed to add item');
      throw error;
    }
  };

  const addItems = async (newItems: Omit<InventoryItem, 'id'>[]) => {
    let itemsWithIds: InventoryItem[] = [];
    try {
      // Add all items to local state
      itemsWithIds = newItems.map(item => ({
        ...item,
        id: generateId(),
      }));
      setItems(prev => [...prev, ...itemsWithIds]);

      // Try to sync with API if authenticated
      if (isAuthenticated && currentCompany && defaultWarehouseId) {
        const apiData = newItems.map(item => mapToAPI(item, defaultWarehouseId));
        // Use individual creates with allSettled so one failure doesn't crash the batch
        const results = await Promise.allSettled(
          apiData.map(item => inventoryService.createInventory(item))
        );
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.warn(`[InventoryContext] ${failures.length}/${results.length} items failed to sync`);
        }

        // Refresh to get server data
        await loadItems(true);
      } else {
        // Store locally
        await storeItems([...items, ...itemsWithIds]);
      }
    } catch (error: any) {
      // Rollback
      setItems(prev => prev.filter(i => !itemsWithIds.find((ai: InventoryItem) => ai.id === i.id)));
      setError(error.message || 'Failed to add items');
      throw error;
    }
  };

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    const previousItems = [...items];
    try {
      // Update local state optimistically
      setItems(prev =>
        prev.map(item => (item.id === id ? { ...item, ...updates } : item))
      );

      // Try to sync with API if authenticated
      if (isAuthenticated && currentCompany) {
        const apiData: UpdateInventoryVM = {
          id,
          title: updates.name || updates.title,
          description: updates.description,
          quantity: updates.quantity,
          price: updates.price,
          barcode: updates.barcode,
          category: updates.category,
        };

        await inventoryService.updateInventory(apiData);
        await loadItems(true); // Refresh to get server state
      } else {
        // Store locally
        await storeItems(items);
      }
    } catch (error: any) {
      // Rollback on error
      setItems(previousItems);
      setError(error.message || 'Failed to update item');
      throw error;
    }
  };

  const removeItem = async (id: string) => {
    const previousItems = [...items];
    try {
      setItems(prev => prev.filter(item => item.id !== id));

      if (isAuthenticated && currentCompany) {
        await inventoryService.deleteInventory(id);
        // No need to refresh as we already removed it locally
      } else {
        await storeItems(items);
      }
    } catch (error: any) {
      // Rollback
      setItems(previousItems);
      setError(error.message || 'Failed to remove item');
      throw error;
    }
  };

  const clearInventory = async () => {
    const previousItems = [...items];
    try {
      setItems([]);

      await storeItems([]);

      // Note: We don't call API to clear all items
      // This should only be used for local cache management
    } catch (error: any) {
      setItems(previousItems);
      setError(error.message || 'Failed to clear inventory');
      throw error;
    }
  };

  const getItemByBarcode = useCallback(
    (barcode: string) => {
      return items.find(item => item.barcode === barcode);
    },
    [items],
  );

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const searchItems = useCallback(
    (query: string) => {
      const lowercaseQuery = query.toLowerCase();
      return items.filter(
        item =>
          item.name.toLowerCase().includes(lowercaseQuery) ||
          item.description?.toLowerCase().includes(lowercaseQuery) ||
          item.barcode?.includes(query)
      );
    },
    [items],
  );

  const filterByCategory = useCallback(
    (category: string) => {
      return items.filter(item => item.category === category);
    },
    [items],
  );

  // Category management (synced with backend)
  const loadCategories = useCallback(async () => {
    if (!isAuthenticated || !currentCompany) return;
    try {
      const apiCategories = await inventoryCategoryService.getCategories();
      const mapped: CustomCategory[] = apiCategories.map(c => ({ id: c.id, name: c.name, color: c.color }));
      setCustomCategories(mapped);
      // Cache locally
      const storageKeys = getStorageKeys(currentCompany?.companyId || null);
      await AsyncStorage.setItem(storageKeys.CATEGORIES, JSON.stringify(mapped));
    } catch (err) {
      console.log('[InventoryContext] Error loading categories from API, using local cache:', err);
    }
  }, [isAuthenticated, currentCompany]);

  const addCategory = useCallback((name: string, color?: string): CustomCategory => {
    const storageKeys = getStorageKeys(currentCompany?.companyId || null);
    const tempId = generateId();
    const newCategory: CustomCategory = {
      id: tempId,
      name: name.trim(),
      color: color || CATEGORY_COLORS[customCategories.length % CATEGORY_COLORS.length],
    };

    // Optimistic update
    setCustomCategories(prev => {
      const updated = [...prev, newCategory];
      AsyncStorage.setItem(storageKeys.CATEGORIES, JSON.stringify(updated));
      return updated;
    });

    // Sync with backend
    if (isAuthenticated && currentCompany) {
      inventoryCategoryService.createCategory({ name: newCategory.name, color: newCategory.color })
        .then(apiCat => {
          // Replace temp id with real id
          setCustomCategories(prev => {
            const updated = prev.map(c => c.id === tempId ? { ...c, id: apiCat.id } : c);
            AsyncStorage.setItem(storageKeys.CATEGORIES, JSON.stringify(updated));
            return updated;
          });
        })
        .catch(err => console.error('[InventoryContext] Error syncing category to API:', err));
    }

    return newCategory;
  }, [customCategories.length, isAuthenticated, currentCompany]);

  const updateCategory = useCallback((id: string, updates: Partial<CustomCategory>) => {
    const storageKeys = getStorageKeys(currentCompany?.companyId || null);
    setCustomCategories(prev => {
      const updated = prev.map(cat => (cat.id === id ? { ...cat, ...updates } : cat));
      AsyncStorage.setItem(storageKeys.CATEGORIES, JSON.stringify(updated));
      return updated;
    });
  }, [currentCompany?.companyId]);

  const removeCategory = useCallback((id: string) => {
    const storageKeys = getStorageKeys(currentCompany?.companyId || null);
    const catToRemove = customCategories.find(c => c.id === id);

    setCustomCategories(prev => {
      const updated = prev.filter(cat => cat.id !== id);
      AsyncStorage.setItem(storageKeys.CATEGORIES, JSON.stringify(updated));
      return updated;
    });

    // Also remove category from items
    if (catToRemove) {
      setItems(prev => {
        const updated = prev.map(item => {
          if (item.category === catToRemove.name) {
            return { ...item, category: undefined };
          }
          return item;
        });
        storeItems(updated);
        return updated;
      });
    }

    // Sync with backend
    if (isAuthenticated && currentCompany) {
      inventoryCategoryService.deleteCategory(id)
        .catch(err => console.error('[InventoryContext] Error deleting category from API:', err));
    }
  }, [customCategories, isAuthenticated, currentCompany]);

  // Clear local state when company changes (data isolation)
  useEffect(() => {
    // Reset state when company changes
    setItems([]);
    setCustomCategories([]);
    setDefaultWarehouseId(null);
    setError(null);

    if (currentCompany?.companyId) {
      // Load data for new company
      loadStoredData();
    }
  }, [currentCompany?.companyId]);

  // Initialize warehouse and load items when authenticated
  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      initializeWarehouse();
      loadItems();
      loadWarehouses();
      loadCategories();
    }
  }, [isAuthenticated, currentCompany, loadWarehouses, loadCategories]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadItems(true), loadWarehouses(), loadCategories()]);
  }, [loadWarehouses, loadCategories]);

  const value = useMemo(
    () => ({
      items,
      isLoading,
      error,
      currentWarehouseId: defaultWarehouseId,
      warehouses,
      setCurrentWarehouse,
      loadWarehouses,
      loadItems,
      addItem,
      addItems,
      updateItem,
      removeItem,
      clearInventory,
      getItemByBarcode,
      totalItems,
      totalValue,
      customCategories,
      addCategory,
      updateCategory,
      removeCategory,
      searchItems,
      filterByCategory,
      refreshAll,
    }),
    [
      items,
      isLoading,
      error,
      defaultWarehouseId,
      warehouses,
      setCurrentWarehouse,
      loadWarehouses,
      addItem,
      addItems,
      updateItem,
      removeItem,
      clearInventory,
      getItemByBarcode,
      totalItems,
      totalValue,
      customCategories,
      addCategory,
      updateCategory,
      removeCategory,
      searchItems,
      filterByCategory,
      refreshAll,
    ],
  );

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
