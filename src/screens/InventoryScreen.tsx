import React, { useCallback, useMemo, memo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Platform,
  ScrollView,
  Modal,
  RefreshControl,
  Image,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Config from 'react-native-config';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import { useEstimate } from '../context/EstimateContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions, PermissionKeys } from '../context/PermissionContext';
import { useFreemiumLimits } from '../hooks/useFreemiumLimits';
import { AnimatedPressable, ConfirmationModal, CategoryBadge, CategoryManagerModal } from '../components/ui';
import { inventoryService as inventoryApiService } from '../services/api/domain/inventory/inventoryService';
import { ExpirationBreakdown } from '../components/ExpirationBreakdown';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, InventoryItem } from '../types/navigation';
import type { InventoryBatchRM } from '../types/apiResponses';
import { inventoryService } from '../services/inventoryService';

interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

interface CollapsibleItemCardProps {
  item: InventoryItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onRequestRemove: (item: InventoryItem) => void;
  onRename: (item: InventoryItem, newName: string) => void;
  onScanBarcode: (id: string) => void;
  onAddToEstimate: (item: InventoryItem) => void;
  onShowExpiration: (item: InventoryItem) => void;
  onAddQuantity: (item: InventoryItem) => void;
  onViewGallery: (item: InventoryItem) => void;
  onMove?: (item: InventoryItem) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  customCategories?: CustomCategory[];
}

const getImageUrl = (imageS3Key?: string, imageUri?: string): string | null => {
  if (imageUri) return imageUri;
  if (imageS3Key) {
    const baseUrl = Config.API_URL?.includes('staging') 
      ? 'https://nmj-dev-gallery.s3.us-east-2.amazonaws.com'
      : 'https://nmj-dev-gallery.s3.us-east-2.amazonaws.com';
    return `${baseUrl}/${imageS3Key}`;
  }
  return null;
};

const CollapsibleItemCard = memo<CollapsibleItemCardProps>(({
  item,
  isExpanded,
  onToggle,
  onRequestRemove,
  onRename,
  onScanBarcode,
  onAddToEstimate,
  onShowExpiration,
  onAddQuantity,
  onViewGallery,
  onMove,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  customCategories = [],
}) => {
  const {colors} = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const lastTapRef = useRef<number>(0);
  const doubleTapDelay = 300;

  // Get category color from custom categories
  const categoryColor = item.category 
    ? customCategories.find(c => c.name === item.category)?.color 
    : undefined;
  const handleRemove = useCallback(() => {
    onRequestRemove(item);
  }, [item, onRequestRemove]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < doubleTapDelay) {
      // Double tap detected - start editing
      setEditName(item.name);
      setIsEditing(true);
    } else {
      // Single tap
      if (isSelectionMode && onSelect) {
        onSelect(item.id);
      } else {
        onToggle(item.id);
      }
    }
    lastTapRef.current = now;
  }, [item.id, item.name, onToggle, isSelectionMode, onSelect]);

  const handleSaveRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== item.name) {
      onRename(item, trimmed);
    }
    setIsEditing(false);
  }, [editName, item, onRename]);

  const handleCancelRename = useCallback(() => {
    setEditName(item.name);
    setIsEditing(false);
  }, [item.name]);

  const handleToggle = useCallback(() => {
    if (isSelectionMode && onSelect) {
      onSelect(item.id);
    } else {
      onToggle(item.id);
    }
  }, [item.id, onToggle, isSelectionMode, onSelect]);

  const itemTotal = item.price * item.quantity;
  const imageUrl = getImageUrl(item.imageS3Key, item.imageUri);

  return (
    <View style={[styles.itemCard, {backgroundColor: colors.surface, borderColor: isExpanded ? colors.accent : 'transparent', borderWidth: isExpanded ? 1 : 0}, isSelected && [styles.itemCardSelected, {borderColor: colors.accent}]]}>
      {/* Collapsed Header - Always visible */}
      <TouchableOpacity
        style={styles.collapsedHeader}
        onPress={handleDoubleTap}
        activeOpacity={0.7}
      >
        {/* Checkbox when in selection mode */}
        {isSelectionMode && (
          <View style={[styles.checkbox, {borderColor: colors.border}, isSelected && [styles.checkboxSelected, {backgroundColor: colors.accent, borderColor: colors.accent}]]}>
            {isSelected && <Icon name="check" size={14} color={colors.textLight} />}
          </View>
        )}
        {/* Item Image Thumbnail */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={[styles.itemThumbnail, {borderColor: colors.border}]} />
        ) : (
          <View style={[styles.itemThumbnailPlaceholder, {backgroundColor: `${colors.accent}08`, borderColor: colors.border}]}>
            <Icon name="package" size={18} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.collapsedInfo}>
          {isEditing ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={[styles.editNameInput, {borderBottomColor: colors.accent, color: colors.text, backgroundColor: 'transparent'}]}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={handleSaveRename}
                onBlur={handleSaveRename}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleCancelRename} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.itemNameRow}>
                <Text style={[styles.itemName, {color: colors.text}]} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={styles.collapsedMeta}>
                {item.category && (
                  <CategoryBadge category={item.category} color={categoryColor} compact />
                )}
                <View style={[styles.qtyBadge, {backgroundColor: `${colors.accent}12`}]}>
                  <Text style={[styles.qtyBadgeText, {color: colors.accent}]}>
                    Qty: {item.quantity}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.collapsedTotal, {color: colors.text}]}>
            ${itemTotal.toFixed(2)}
          </Text>
          <Text style={[styles.collapsedUnitPrice, {color: colors.textSecondary}]}>
            ${item.price.toFixed(2)}/ea
          </Text>
        </View>
        {!isSelectionMode && (
          <View style={[styles.chevronWrap, {backgroundColor: isExpanded ? `${colors.accent}12` : colors.background}]}>
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={isExpanded ? colors.accent : colors.textSecondary}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={[styles.expandedContent, {borderTopColor: colors.border}]}>
          {/* Meta Info Chips */}
          {(item.barcode || item.store || item.purchaseDate) && (
            <View style={styles.expandedMeta}>
              {item.barcode && (
                <View style={[styles.barcodeChip, {backgroundColor: `${colors.accent}10`}]}>
                  <Icon name="maximize" size={11} color={colors.accent} />
                  <Text style={[styles.barcodeChipText, {color: colors.accent}]}>{item.barcode}</Text>
                </View>
              )}
              {item.store && (
                <View style={[styles.metaChip, {backgroundColor: colors.background}]}>
                  <Icon name="shopping-bag" size={11} color={colors.textSecondary} />
                  <Text style={[styles.metaChipText, {color: colors.textSecondary}]}>{item.store}</Text>
                </View>
              )}
              {item.purchaseDate && (
                <View style={[styles.metaChip, {backgroundColor: colors.background}]}>
                  <Icon name="calendar" size={11} color={colors.textSecondary} />
                  <Text style={[styles.metaChipText, {color: colors.textSecondary}]}>
                    {new Date(item.purchaseDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quick Actions - Labeled buttons */}
          <View style={styles.quickActionsRow}>
            {imageUrl && (
              <AnimatedPressable style={[styles.quickActionBtn, {backgroundColor: colors.background}]} onPress={() => onViewGallery(item)}>
                <Icon name="image" size={16} color={colors.info} />
                <Text style={[styles.quickActionLabel, {color: colors.info}]}>Photo</Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable style={[styles.quickActionBtn, {backgroundColor: colors.background}]} onPress={() => onShowExpiration(item)}>
              <Icon name="layers" size={16} color={colors.warning} />
              <Text style={[styles.quickActionLabel, {color: colors.warning}]}>Stock</Text>
            </AnimatedPressable>
            <AnimatedPressable style={[styles.quickActionBtnPrimary, {backgroundColor: colors.accent}]} onPress={() => onAddQuantity(item)}>
              <Icon name="plus" size={18} color={colors.textLight} />
              <Text style={[styles.quickActionLabelPrimary, {color: colors.textLight}]}>Add Qty</Text>
            </AnimatedPressable>
            <AnimatedPressable style={[styles.quickActionBtn, {backgroundColor: colors.background}]} onPress={() => onAddToEstimate(item)}>
              <Icon name="file-plus" size={16} color={colors.accent} />
              <Text style={[styles.quickActionLabel, {color: colors.accent}]}>Estimate</Text>
            </AnimatedPressable>
            {onMove && (
              <AnimatedPressable style={[styles.quickActionBtn, {backgroundColor: colors.background}]} onPress={() => onMove(item)}>
                <Icon name="truck" size={16} color={colors.info} />
                <Text style={[styles.quickActionLabel, {color: colors.info}]}>Move</Text>
              </AnimatedPressable>
            )}
            <AnimatedPressable style={[styles.quickActionBtn, {backgroundColor: `${colors.error}08`}]} onPress={handleRemove}>
              <Icon name="trash-2" size={16} color={colors.error} />
              <Text style={[styles.quickActionLabel, {color: colors.error}]}>Delete</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}
    </View>
  );
});

CollapsibleItemCard.displayName = 'CollapsibleItemCard';

const EmptyInventory = memo(() => {
  const {colors} = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconWrap, {backgroundColor: colors.surface}]}>
        <Icon name="package" size={40} color={colors.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, {color: colors.text}]}>No Materials Yet</Text>
      <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
        Add materials by scanning receipts or entering them manually.
      </Text>
    </View>
  );
});

EmptyInventory.displayName = 'EmptyInventory';

export const InventoryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  // Check if we're in a tab (InventoryTab) vs pushed as a stack screen
  const isInTab = route.name === 'InventoryTab';

  const { items, removeItem, updateItem, totalItems, totalValue, clearInventory, customCategories, addCategory, removeCategory, warehouses, currentWarehouseId, setCurrentWarehouse, loadWarehouses, refreshAll, loadItems } =
    useInventory();
  const { enforceLimit } = useFreemiumLimits();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll]);
  const [showWarehousePicker, setShowWarehousePicker] = useState(false);
  const currentWarehouse = useMemo(() => warehouses.find(w => w.id === currentWarehouseId), [warehouses, currentWarehouseId]);
  const { currentCompany } = useAuth();
  const { hasPermission } = usePermissions();

  // Reload warehouses when screen gains focus (after creating a new warehouse in settings)
  useFocusEffect(
    useCallback(() => {
      loadWarehouses();
    }, [loadWarehouses])
  );
  
  // Check permissions
  const role = currentCompany?.role?.toLowerCase() || '';
  const isAdminOrLeader = role === 'admin' || role === 'superadmin' || role === 'leader';
  const canManageInventory = isAdminOrLeader || hasPermission(PermissionKeys.ManageInventory);
  const canCreateJobs = isAdminOrLeader || hasPermission(PermissionKeys.CreateJobs);

  // Expansion states
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Allocated tab
  const [activeTab, setActiveTab] = useState<'inventory' | 'allocated'>('inventory');
  const [allocatedData, setAllocatedData] = useState<any>(null);
  const [loadingAllocated, setLoadingAllocated] = useState(false);
  const [expandedAllocatedItems, setExpandedAllocatedItems] = useState<Record<number, boolean>>({});

  const loadAllocatedData = useCallback(async () => {
    setLoadingAllocated(true);
    try {
      const data = await inventoryApiService.getAllocatedInventory();
      setAllocatedData(data);
    } catch (error) {
      console.error('[Inventory] Error loading allocated data:', error);
    } finally {
      setLoadingAllocated(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'allocated' && !allocatedData) {
      loadAllocatedData();
    }
  }, [activeTab, allocatedData, loadAllocatedData]);
  
  // Selection mode for batch tagging
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  // Filtered items by category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(item => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const allExpanded = useMemo(
    () => items.length > 0 && expandedIds.size === items.length,
    [items.length, expandedIds.size],
  );

  const toggleItem = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(items.map(item => item.id)));
    }
  }, [allExpanded, items]);

  // Modal states
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<InventoryItem | null>(null);
  const [expirationModalVisible, setExpirationModalVisible] = useState(false);
  const [selectedItemForExpiration, setSelectedItemForExpiration] = useState<InventoryItem | null>(null);
  const [selectedItemBatches, setSelectedItemBatches] = useState<InventoryBatchRM[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Move inventory state
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [itemToMove, setItemToMove] = useState<InventoryItem | null>(null);
  const [moveQuantity, setMoveQuantity] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const handleRequestRemove = useCallback((item: InventoryItem) => {
    setItemToRemove(item);
    setRemoveModalVisible(true);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (itemToRemove) {
      removeItem(itemToRemove.id);
    }
    setRemoveModalVisible(false);
    setItemToRemove(null);
  }, [itemToRemove, removeItem]);

  const handleCancelRemove = useCallback(() => {
    setRemoveModalVisible(false);
    setItemToRemove(null);
  }, []);

  const handleMoveItem = useCallback((item: InventoryItem) => {
    if (warehouses.length < 2) {
      Alert.alert('Only One Warehouse', 'Create another warehouse first to move items between them.');
      return;
    }
    setItemToMove(item);
    setMoveQuantity(String(item.quantity));
    setMoveModalVisible(true);
  }, [warehouses]);

  const handleConfirmMove = useCallback(async (targetWarehouseId: string) => {
    if (!itemToMove || !currentWarehouseId) return;
    const qty = parseInt(moveQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity to move.');
      return;
    }
    if (qty > itemToMove.quantity) {
      Alert.alert('Exceeds Available', `You only have ${itemToMove.quantity} units available.`);
      return;
    }
    setIsMoving(true);
    try {
      await inventoryApiService.moveInventory({
        inventoryId: itemToMove.id,
        sourceWarehouseId: currentWarehouseId,
        targetWarehouseId,
        quantityToMove: qty,
      });
      setMoveModalVisible(false);
      setItemToMove(null);
      Alert.alert('Moved!', `${qty} ${qty === 1 ? 'unit' : 'units'} of ${itemToMove.name} moved successfully.`);
      refreshAll();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to move inventory.');
    } finally {
      setIsMoving(false);
    }
  }, [itemToMove, currentWarehouseId, moveQuantity, refreshAll]);

  const handleShowExpiration = useCallback(async (item: InventoryItem) => {
    console.log('[InventoryScreen] handleShowExpiration called with item:', item.id, item.title || item.name);
    setSelectedItemForExpiration(item);
    setExpirationModalVisible(true);
    setLoadingBatches(true);
    setSelectedItemBatches([]);
    
    try {
      console.log('[InventoryScreen] Fetching inventory item with batches, id:', item.id);
      const apiItem = await inventoryService.getInventoryById(item.id);
      console.log('[InventoryScreen] API response:', JSON.stringify(apiItem, null, 2));
      
      if (apiItem?.batches && apiItem.batches.length > 0) {
        console.log('[InventoryScreen] Found batches:', apiItem.batches.length);
        setSelectedItemBatches(apiItem.batches);
      } else {
        console.log('[InventoryScreen] No batches found in response');
      }
    } catch (error) {
      console.error('[InventoryScreen] Error fetching inventory item:', error);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  const handleCloseExpirationModal = useCallback(() => {
    setExpirationModalVisible(false);
    setSelectedItemForExpiration(null);
  }, []);

  // Barcode scanning disabled – kept as no-op to preserve component API
  const handleScanBarcode = useCallback(
    (_itemId: string) => {
      // navigation.navigate('BarcodeScanner', { ... });
    },
    [],
  );

  const handleAddInventory = useCallback(() => {
    if (!enforceLimit('inventory', items.length)) return;
    navigation.navigate('AddInventory');
  }, [navigation, enforceLimit, items.length]);

  // Add to Estimate functionality
  const { initDraft, addFromInventory } = useEstimate();
  const [addedToEstimateModal, setAddedToEstimateModal] = useState(false);
  const [addedItemName, setAddedItemName] = useState('');

  const handleAddToEstimate = useCallback((item: InventoryItem) => {
    // Initialize a new draft if none exists, then add the item
    initDraft();
    addFromInventory([item]);
    setAddedItemName(item.name);
    setAddedToEstimateModal(true);
  }, [initDraft, addFromInventory]);

  const handleGoToEstimate = useCallback(() => {
    setAddedToEstimateModal(false);
    navigation.navigate('CreateEstimate');
  }, [navigation]);

  // Add Quantity Modal state
  const [addQuantityModalVisible, setAddQuantityModalVisible] = useState(false);
  const [selectedItemForAddQty, setSelectedItemForAddQty] = useState<InventoryItem | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState('1');
  const [isAddingQuantity, setIsAddingQuantity] = useState(false);

  const handleAddQuantity = useCallback((item: InventoryItem) => {
    setSelectedItemForAddQty(item);
    setQuantityToAdd('1');
    setAddQuantityModalVisible(true);
  }, []);

  const handleConfirmAddQuantity = useCallback(async () => {
    if (!selectedItemForAddQty) return;
    
    const qty = parseInt(quantityToAdd, 10);
    if (isNaN(qty) || qty <= 0) return;

    setIsAddingQuantity(true);
    try {
      await inventoryService.addQuantity({
        inventoryId: selectedItemForAddQty.id,
        quantity: qty,
        notes: 'Added via mobile app',
      });
      // Refresh inventory list
      loadItems(true);
      setAddQuantityModalVisible(false);
      setSelectedItemForAddQty(null);
      setSuccessModalVisible(true);
    } catch (error) {
      console.error('[InventoryScreen] Error adding quantity:', error);
    } finally {
      setIsAddingQuantity(false);
    }
  }, [selectedItemForAddQty, quantityToAdd, loadItems]);

  const handleConfirmClear = useCallback(() => {
    clearInventory();
    setClearModalVisible(false);
  }, [clearInventory]);

  const handleCancelClear = useCallback(() => {
    setClearModalVisible(false);
  }, []);

  // Gallery Modal state
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [selectedItemForGallery, setSelectedItemForGallery] = useState<InventoryItem | null>(null);

  const handleViewGallery = useCallback((item: InventoryItem) => {
    const imageUrl = getImageUrl(item.imageS3Key, item.imageUri);
    console.log('[InventoryScreen] Opening gallery for:', item.name);
    console.log('[InventoryScreen] imageS3Key:', item.imageS3Key);
    console.log('[InventoryScreen] imageUri:', item.imageUri);
    console.log('[InventoryScreen] Computed URL:', imageUrl);
    setSelectedItemForGallery(item);
    setGalleryModalVisible(true);
  }, []);

  const handleCloseGallery = useCallback(() => {
    setGalleryModalVisible(false);
    setSelectedItemForGallery(null);
  }, []);
  
  // Handle category change
  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(prev => prev === category ? null : category);
  }, []);

  // Selection mode handlers
  const handleStartBatchMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedItemIds(new Set());
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItemIds(new Set());
  }, []);

  const handleToggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedItemIds(new Set(filteredItems.map(item => item.id)));
  }, [filteredItems]);

  const handleDeselectAll = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const handleApplyCategory = useCallback((categoryName: string) => {
    selectedItemIds.forEach(itemId => {
      updateItem(itemId, { category: categoryName });
    });
    handleExitSelectionMode();
  }, [selectedItemIds, updateItem, handleExitSelectionMode]);

  const handleRemoveCategory = useCallback(() => {
    selectedItemIds.forEach(itemId => {
      updateItem(itemId, { category: undefined });
    });
    handleExitSelectionMode();
  }, [selectedItemIds, updateItem, handleExitSelectionMode]);

  // Handle rename item (double tap)
  const handleRenameItem = useCallback(async (item: InventoryItem, newName: string) => {
    try {
      await updateItem(item.id, { name: newName });
    } catch (error) {
      Alert.alert('Error', 'Failed to rename item');
    }
  }, [updateItem]);

  // renderItem must be declared after handleToggleItemSelection
  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => (
      <CollapsibleItemCard
        key={item.id}
        item={item}
        isExpanded={expandedIds.has(item.id)}
        onToggle={toggleItem}
        onRequestRemove={handleRequestRemove}
        onRename={handleRenameItem}
        onScanBarcode={handleScanBarcode}
        onAddToEstimate={handleAddToEstimate}
        onShowExpiration={handleShowExpiration}
        onAddQuantity={handleAddQuantity}
        onViewGallery={handleViewGallery}
        onMove={warehouses.length >= 2 ? handleMoveItem : undefined}
        isSelectionMode={isSelectionMode}
        isSelected={selectedItemIds.has(item.id)}
        onSelect={handleToggleItemSelection}
        customCategories={customCategories}
      />
    ),
    [expandedIds, toggleItem, handleRequestRemove, handleRenameItem, handleScanBarcode, handleAddToEstimate, handleShowExpiration, handleAddQuantity, handleViewGallery, handleMoveItem, warehouses, isSelectionMode, selectedItemIds, handleToggleItemSelection, customCategories],
  );

  const keyExtractor = useCallback((item: InventoryItem) => item.id, []);

  const ListHeader = useMemo(
    () => null,
    [],
  );

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      {/* Selection Mode Header */}
      {isSelectionMode ? (
        <View style={[styles.selectionHeader, {backgroundColor: colors.accent}]}>
          <TouchableOpacity
            style={[styles.selectionBackBtn, {backgroundColor: colors.surface}]}
            onPress={handleExitSelectionMode}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="x" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.selectionHeaderTitle, {color: colors.text}]}>
            {selectedItemIds.size > 0 
              ? `${selectedItemIds.size} selected`
              : 'Select items'
            }
          </Text>
          <View style={styles.selectionHeaderActions}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAll}>
              <Text style={[styles.selectAllText, {color: colors.text}]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectAllBtn} onPress={handleDeselectAll}>
              <Text style={[styles.selectAllText, {color: colors.text}]}>None</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Compact Header - with warehouse dropdown in title */}
          <View style={[styles.compactHeader, {backgroundColor: colors.accent}]}>
            <View style={styles.compactHeaderLeft}>
              {!isInTab && (
                <TouchableOpacity                   style={[styles.backButtonCompact, {backgroundColor: colors.surface}]}
                  onPress={() => navigation.goBack()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="arrow-left" size={20} color={colors.textLight} />
                </TouchableOpacity>
              )}
              {/* Warehouse dropdown as header title */}
              {warehouses.length > 0 ? (
                <TouchableOpacity 
                  style={styles.warehouseTitleDropdown} 
                  onPress={() => setShowWarehousePicker(true)}
                >
                  <Text style={[styles.compactHeaderTitle, {color: colors.textLight}]}>
                    {currentWarehouse?.name || 'All Warehouses'}
                  </Text>
                  <Icon name="chevron-down" size={18} color={colors.textLight} />
                </TouchableOpacity>
              ) : (
                <Text style={[styles.compactHeaderTitle, {color: colors.textLight}]}>Inventory</Text>
              )}
              <Text style={styles.compactHeaderMeta}>{totalItems} items</Text>
            </View>
            <Text style={[styles.compactHeaderTotal, {color: colors.textLight}]}>
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          
          {/* Action Buttons Row */}
          {items.length > 0 && (
            <View style={[styles.headerActionsRow, {backgroundColor: colors.background, borderBottomColor: colors.divider}]}>
              {canManageInventory && (
                <TouchableOpacity
                  style={[styles.headerActionBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                  onPress={() => setShowCategoryManager(true)}
                >
                  <Icon name="tag" size={16} color={colors.accent} />
                  <Text style={[styles.headerActionText, {color: colors.accent}]}>Categories</Text>
                </TouchableOpacity>
              )}
              {canCreateJobs && (
                <TouchableOpacity
                  style={[styles.headerActionBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                  onPress={() => navigation.navigate('SelectInventoryForJob')}
                >
                  <Icon name="briefcase" size={16} color={colors.accent} />
                  <Text style={[styles.headerActionText, {color: colors.accent}]}>Create Job</Text>
                </TouchableOpacity>
              )}
              {canManageInventory && (
                <TouchableOpacity
                  style={[styles.headerActionBtnPrimary, {backgroundColor: colors.accent}]}
                  onPress={handleAddInventory}
                >
                  <Icon name="plus" size={16} color={colors.textLight} />
                  <Text style={[styles.headerActionTextPrimary, {color: colors.textLight}]}>Add</Text>
                </TouchableOpacity>
              )}
              <AnimatedPressable style={[styles.headerActionBtn, {backgroundColor: colors.surface, borderColor: colors.border}]} onPress={toggleAll}>
                <Icon
                  name={allExpanded ? 'minimize-2' : 'maximize-2'}
                  size={16}
                  color={colors.accent}
                />
                <Text style={[styles.headerActionText, {color: colors.accent}]}>
                  {allExpanded ? 'Collapse' : 'Expand'}
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </>
      )}

      {/* Tab Toggle: Inventory / Allocated */}
      {items.length > 0 && (
        <View style={{flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.divider}}>
          <TouchableOpacity
            style={{flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'inventory' ? colors.accent : 'transparent'}}
            onPress={() => setActiveTab('inventory')}
          >
            <Text style={{fontSize: 14, fontWeight: activeTab === 'inventory' ? '700' : '500', color: activeTab === 'inventory' ? colors.accent : colors.textSecondary}}>
              Inventory
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: activeTab === 'allocated' ? colors.accent : 'transparent'}}
            onPress={() => setActiveTab('allocated')}
          >
            <Text style={{fontSize: 14, fontWeight: activeTab === 'allocated' ? '700' : '500', color: activeTab === 'allocated' ? colors.accent : colors.textSecondary}}>
              Allocated
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'allocated' ? (
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={{padding: 16}}
          refreshControl={
            <RefreshControl refreshing={loadingAllocated} onRefresh={loadAllocatedData} colors={[colors.accent]} tintColor={colors.accent} />
          }
        >
          {loadingAllocated && !allocatedData ? (
            <View style={{alignItems: 'center', paddingVertical: 40}}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{color: colors.textSecondary, marginTop: 12, fontSize: 14}}>Loading allocated items...</Text>
            </View>
          ) : allocatedData?.items?.length === 0 ? (
            <View style={{alignItems: 'center', paddingVertical: 40}}>
              <Icon name="package" size={40} color={colors.textSecondary} />
              <Text style={{color: colors.textSecondary, marginTop: 12, fontSize: 16, fontWeight: '600'}}>No Allocated Items</Text>
              <Text style={{color: colors.textSecondary, marginTop: 4, fontSize: 13, textAlign: 'center'}}>
                Items will appear here when they are assigned to active jobs
              </Text>
            </View>
          ) : (
            <>
              {allocatedData?.items?.map((item: any, idx: number) => {
                const isExpanded = expandedAllocatedItems[idx];
                return (
                  <View key={idx} style={{backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden'}}>
                    <TouchableOpacity
                      style={{flexDirection: 'row', alignItems: 'center', padding: 14}}
                      onPress={() => setExpandedAllocatedItems(prev => ({...prev, [idx]: !prev[idx]}))}
                      activeOpacity={0.7}
                    >
                      <View style={{width: 40, height: 40, borderRadius: 10, backgroundColor: `${colors.accent}12`, alignItems: 'center', justifyContent: 'center', marginRight: 12}}>
                        <Icon name="package" size={18} color={colors.accent} />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={{fontSize: 15, fontWeight: '600', color: colors.text}} numberOfLines={1}>{item.itemTitle}</Text>
                        <Text style={{fontSize: 12, color: colors.textSecondary, marginTop: 2}}>
                          {item.totalAllocated} {item.totalAllocated === 1 ? 'unit' : 'units'} · {item.jobs?.length || 0} {(item.jobs?.length || 0) === 1 ? 'job' : 'jobs'}
                        </Text>
                      </View>
                      <View style={{backgroundColor: `${colors.accent}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8}}>
                        <Text style={{fontSize: 13, fontWeight: '700', color: colors.accent}}>{item.totalAllocated}</Text>
                      </View>
                      <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={{paddingHorizontal: 14, paddingBottom: 12, gap: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10}}>
                        {item.jobs?.map((job: any, jIdx: number) => (
                          <TouchableOpacity
                            key={jIdx}
                            style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.background, borderRadius: 8}}
                            onPress={() => navigation.navigate('JobDetail', { jobId: job.jobId })}
                          >
                            <Icon name="briefcase" size={14} color={colors.accent} />
                            <Text style={{fontSize: 13, fontWeight: '500', color: colors.text, marginLeft: 8, flex: 1}} numberOfLines={1}>
                              {job.jobTitle}
                            </Text>
                            <Text style={{fontSize: 12, fontWeight: '600', color: colors.textSecondary}}>{job.allocatedQuantity} {job.allocatedQuantity === 1 ? 'unit' : 'units'}</Text>
                            <Icon name="chevron-right" size={14} color={colors.textSecondary} style={{marginLeft: 6}} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      ) : items.length === 0 ? (
        <View style={[styles.emptyWrapper, {backgroundColor: colors.surface}]}>
          <EmptyInventory />
          <AnimatedPressable style={[styles.addBtn, {backgroundColor: colors.accent}]} onPress={handleAddInventory}>
            <Icon name="plus" size={20} color={colors.textLight} />
            <Text style={[styles.addBtnText, {color: colors.textLight}]}>Add Materials</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <>
          {/* Category Filter */}
          {customCategories.length > 0 && (
            <View style={[styles.categoryFilterContainer, {backgroundColor: colors.background, borderBottomColor: colors.divider}]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsRow}
              >
                <TouchableOpacity
                  style={[styles.categoryChip, {backgroundColor: colors.surface, borderColor: colors.border}, !selectedCategory && [styles.categoryChipActive, {backgroundColor: colors.accent}]]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={[styles.categoryChipText, {color: colors.text}, !selectedCategory && [styles.categoryChipTextActive, {color: colors.textLight}]]}>All</Text>
                </TouchableOpacity>
                {customCategories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {backgroundColor: colors.surface, borderColor: cat.color},
                      selectedCategory === cat.name && [styles.categoryChipActive, {backgroundColor: colors.accent}],
                    ]}
                    onPress={() => handleCategoryChange(cat.name)}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                    <Text style={[
                      styles.categoryChipText,
                      {color: colors.text},
                      selectedCategory === cat.name && [styles.categoryChipTextActive, {color: colors.textLight}],
                    ]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          <FlatList
            data={filteredItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={ListHeader}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.accent]}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyFilterResult}>
                <Icon name="filter" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyFilterText, {color: colors.textSecondary}]}>No items in "{selectedCategory}"</Text>
              </View>
            }
          />

        </>
      )}

      {/* Remove Item Modal */}
      <ConfirmationModal
        visible={removeModalVisible}
        title="Remove Material"
        message={`Remove "${itemToRemove?.name}" from inventory?`}
        icon="trash-2"
        iconColor={colors.error}
        buttons={[
          { text: 'Cancel', onPress: handleCancelRemove, style: 'cancel' },
          { text: 'Remove', onPress: handleConfirmRemove, style: 'destructive' },
        ]}
      />

      {/* Clear All Modal */}
      <ConfirmationModal
        visible={clearModalVisible}
        title="Clear Inventory"
        message="Are you sure you want to remove all materials?"
        icon="alert-triangle"
        iconColor={colors.error}
        buttons={[
          { text: 'Cancel', onPress: handleCancelClear, style: 'cancel' },
          { text: 'Clear All', onPress: handleConfirmClear, style: 'destructive' },
        ]}
      />

      {/* Success Modal */}
      <ConfirmationModal
        visible={successModalVisible}
        title="Success"
        message="Barcode added to material!"
        icon="check-circle"
        iconColor={colors.success}
        buttons={[
          { text: 'OK', onPress: () => setSuccessModalVisible(false) },
        ]}
      />

      {/* Added to Estimate Modal */}
      <ConfirmationModal
        visible={addedToEstimateModal}
        title="Added to Estimate"
        message={`"${addedItemName}" has been added to your estimate draft.`}
        icon="check-circle"
        iconColor={colors.success}
        buttons={[
          { text: 'Cancel', onPress: () => setAddedToEstimateModal(false), style: 'cancel' },
          { text: 'Go to Estimate', onPress: handleGoToEstimate },
        ]}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={customCategories}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
        inventoryItems={items.map(item => ({ id: item.id, name: item.name, category: item.category }))}
        onUpdateItemCategory={(itemId, categoryName) => updateItem(itemId, { category: categoryName })}
        onStartBatchMode={handleStartBatchMode}
      />

      {/* Warehouse Picker Modal */}
      <Modal visible={showWarehousePicker} animationType="fade" transparent>
        <View style={styles.warehouseModalOverlay}>
          <View style={[styles.warehouseModal, {backgroundColor: colors.background}]}>
            <View style={[styles.warehouseModalHeader, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
              <Text style={[styles.warehouseModalTitle, {color: colors.text}]}>Select Warehouse</Text>
              <TouchableOpacity onPress={() => setShowWarehousePicker(false)}>
                <Icon name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={warehouses}
              keyExtractor={w => w.id}
              renderItem={({ item: w }) => (
                <TouchableOpacity
                  style={[styles.warehouseItem, {backgroundColor: colors.surface, borderColor: colors.border}, w.id === currentWarehouseId && {backgroundColor: `${colors.accent}15`, borderColor: colors.accent}]}
                  onPress={() => { setCurrentWarehouse(w.id); setShowWarehousePicker(false); }}
                >
                  <View style={[styles.warehouseItemIcon, {backgroundColor: colors.background}, w.id === currentWarehouseId && {backgroundColor: colors.accent}]}>
                    <Icon name="package" size={20} color={w.id === currentWarehouseId ? colors.textLight : colors.accent} />
                  </View>
                  <View style={styles.warehouseItemInfo}>
                    <Text style={[styles.warehouseItemName, {color: colors.text}, w.id === currentWarehouseId && {color: colors.accent, fontWeight: '700'}]}>{w.name}</Text>
                    {w.city && <Text style={[styles.warehouseItemLocation, {color: colors.textSecondary}]}>{w.city}, {w.state}</Text>}
                  </View>
                  {w.id === currentWarehouseId && <Icon name="check" size={20} color={colors.accent} />}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.warehouseList}
            />
          </View>
        </View>
      </Modal>

      {/* Selection Mode Bottom Bar */}
      {isSelectionMode && selectedItemIds.size > 0 && (
        <View style={[styles.selectionBottomBar, {backgroundColor: colors.surface}]}>
          <Text style={[styles.selectionBottomTitle, {color: colors.text}]}>Apply category:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectionCategoryChips}
          >
            {customCategories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.selectionCategoryChip, {backgroundColor: colors.background, borderColor: colors.border}]}
                onPress={() => handleApplyCategory(cat.name)}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={[styles.selectionCategoryChipText, {color: colors.text}]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity               style={[styles.selectionCategoryChip, {backgroundColor: colors.surface}, styles.removeCategoryChip]}
              onPress={handleRemoveCategory}
            >
              <Icon name="x" size={14} color={colors.error} />
              <Text style={[styles.selectionCategoryChipText, { color: colors.error }]}>Remove</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Add Quantity Modal */}
      <Modal visible={addQuantityModalVisible} transparent animationType="fade">
        <View style={styles.addQtyModalOverlay}>
          <View style={[styles.addQtyModalContent, {backgroundColor: colors.surface}]}>
            <View style={styles.addQtyModalHeader}>
              <Text style={[styles.addQtyModalTitle, {color: colors.text}]}>Add Quantity</Text>
              <TouchableOpacity onPress={() => setAddQuantityModalVisible(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.addQtyModalItemName, {color: colors.text}]}>{selectedItemForAddQty?.name}</Text>
            <Text style={[styles.addQtyModalLabel, {color: colors.textSecondary}]}>Quantity to add:</Text>
            <View style={styles.addQtyInputRow}>
              <TouchableOpacity
                style={[styles.addQtyBtn, {backgroundColor: colors.accent}]}
                onPress={() => setQuantityToAdd(prev => String(Math.max(1, parseInt(prev, 10) - 1)))}
              >
                <Icon name="minus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={[styles.addQtyInputContainer, {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border}]}>
                <TextInput
                  style={[styles.addQtyInputText, {color: colors.text}]}
                  value={quantityToAdd}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setQuantityToAdd(num || '1');
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  textAlign="center"
                />
              </View>
              <TouchableOpacity
                style={[styles.addQtyBtn, {backgroundColor: colors.accent}]}
                onPress={() => setQuantityToAdd(prev => String(parseInt(prev, 10) + 1))}
              >
                <Icon name="plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.addQtyModalNote, {color: colors.text}]}>
              A new batch will be created with 30-day return window
            </Text>
            <View style={styles.addQtyModalActions}>
              <TouchableOpacity
                style={[styles.addQtyModalCancelBtn, {backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border}]}
                onPress={() => setAddQuantityModalVisible(false)}
              >
                <Text style={[styles.addQtyModalCancelText, {color: colors.text}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity                 style={[styles.addQtyModalConfirmBtn, {backgroundColor: colors.accent}, isAddingQuantity && styles.addQtyModalBtnDisabled]}
                onPress={handleConfirmAddQuantity}
                disabled={isAddingQuantity}
              >
                <Text style={[styles.addQtyModalConfirmText, {color: '#FFFFFF'}]}>
                  {isAddingQuantity ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move Inventory Modal */}
      <Modal visible={moveModalVisible} transparent animationType="fade">
        <View style={styles.addQtyModalOverlay}>
          <View style={[styles.addQtyModalContent, {backgroundColor: colors.surface}]}>
            <View style={styles.addQtyModalHeader}>
              <Text style={[styles.addQtyModalTitle, {color: colors.text}]}>Move Inventory</Text>
              <TouchableOpacity onPress={() => setMoveModalVisible(false)}>
                <Icon name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.addQtyModalItemName, {color: colors.text}]}>{itemToMove?.name}</Text>
            <Text style={[styles.addQtyModalLabel, {color: colors.textSecondary}]}>Quantity to move:</Text>
            <View style={styles.addQtyInputRow}>
              <TouchableOpacity
                style={[styles.addQtyBtn, {backgroundColor: colors.accent}]}
                onPress={() => setMoveQuantity(prev => String(Math.max(1, parseInt(prev, 10) - 1)))}
              >
                <Icon name="minus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={[styles.addQtyInputContainer, {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border}]}>
                <TextInput
                  style={[styles.addQtyInputText, {color: colors.text}]}
                  value={moveQuantity}
                  onChangeText={(text) => {
                    const num = text.replace(/[^0-9]/g, '');
                    setMoveQuantity(num || '1');
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  textAlign="center"
                />
              </View>
              <TouchableOpacity
                style={[styles.addQtyBtn, {backgroundColor: colors.accent}]}
                onPress={() => setMoveQuantity(prev => String(Math.min(itemToMove?.quantity || 999, parseInt(prev, 10) + 1)))}
              >
                <Icon name="plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.addQtyModalLabel, {color: colors.textSecondary, marginTop: 12}]}>Move to:</Text>
            <View style={{gap: 8, marginTop: 8}}>
              {warehouses.filter(w => w.id !== currentWarehouseId).map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border}}
                  onPress={() => handleConfirmMove(w.id)}
                  disabled={isMoving}
                >
                  <Icon name="package" size={18} color={colors.accent} />
                  <Text style={{fontSize: 15, fontWeight: '500', color: colors.text, marginLeft: 10, flex: 1}}>{w.name}</Text>
                  <Icon name="arrow-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
            {isMoving && (
              <View style={{alignItems: 'center', marginTop: 12}}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={{fontSize: 13, color: colors.textSecondary, marginTop: 4}}>Moving...</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.addQtyModalCancelBtn, {backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginTop: 16}]}
              onPress={() => setMoveModalVisible(false)}
            >
              <Text style={[styles.addQtyModalCancelText, {color: colors.text}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Expiration Breakdown Modal */}
      <ExpirationBreakdown
        visible={expirationModalVisible}
        batches={selectedItemBatches}
        itemTitle={selectedItemForExpiration?.title || selectedItemForExpiration?.name || ''}
        onClose={handleCloseExpirationModal}
        loading={loadingBatches}
        inventoryId={selectedItemForExpiration?.id}
      />

      {/* Gallery Modal */}
      <Modal visible={galleryModalVisible} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.galleryModalOverlay} 
          activeOpacity={1} 
          onPress={handleCloseGallery}
        >
          <View style={[styles.galleryModalContent, {backgroundColor: colors.surface}]}>
              <View style={styles.galleryModalHeader}>
                <Text style={[styles.galleryModalTitle, {color: colors.text}]}>{selectedItemForGallery?.name}</Text>
                <TouchableOpacity onPress={handleCloseGallery} style={{padding: 8}}>
                  <Icon name="x" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {selectedItemForGallery && (
                getImageUrl(selectedItemForGallery.imageS3Key, selectedItemForGallery.imageUri) ? (
                  <Image
                    source={{ uri: getImageUrl(selectedItemForGallery.imageS3Key, selectedItemForGallery.imageUri)! }}
                    style={styles.galleryImage}
                    resizeMode="contain"
                    onError={(e) => console.log('[Gallery] Image load error:', e.nativeEvent.error)}
                    onLoad={() => console.log('[Gallery] Image loaded successfully')}
                  />
                ) : (
                  <View style={[styles.galleryImage, {backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center'}]}>
                    <Icon name="image" size={48} color={colors.textSecondary} />
                    <Text style={{color: colors.textSecondary, marginTop: 12}}>Imagem não disponível</Text>
                  </View>
                )
              )}
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
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },

  // Compact Header (like New Estimate)
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,

    borderBottomWidth: 1,

  },
  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButtonCompact: {
    padding: theme.spacing.xs,
  },
  compactHeaderTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  warehouseTitleDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactHeaderMeta: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  compactHeaderTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,

    borderBottomWidth: 1,

  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,

    borderWidth: 1,

  },
  headerActionText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,

  },
  headerActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,

  },
  headerActionTextPrimary: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,

  },

  // Header Card (legacy - kept for reference)
  headerCard: {

    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCardContent: {
    alignItems: 'center',
  },
  headerCardLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing.xs,
  },
  headerCardValue: {
    fontSize: 42,
    fontWeight: theme.fontWeight.bold,

    letterSpacing: -1,
  },
  headerCardMeta: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: theme.spacing.xs,
  },
  clearBtnHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary Card (legacy - can be removed if not used)
  summaryCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  summaryMain: {
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,

    letterSpacing: -1,
  },
  summaryMeta: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: theme.spacing.sm,
  },
  summaryMetaText: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },

  // List Header with Toggle All
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  toggleAllText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },

  // Item Card (Collapsible)
  itemCard: {

    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    paddingRight: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  collapsedInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    flexShrink: 1,
  },
  editNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  editNameInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    borderBottomWidth: 1,

    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  collapsedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  qtyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
  },
  qtyBadgeText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
  },
  headerRight: {
    alignItems: 'flex-end',
    marginRight: theme.spacing.xs,
  },
  collapsedTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  collapsedUnitPrice: {
    fontSize: 10,
    marginTop: 1,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Expanded Content
  expandedContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,

    paddingTop: theme.spacing.md,
  },
  // Expanded Meta Chips
  expandedMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  barcodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,

    borderRadius: theme.borderRadius.full,
  },
  barcodeChipText: {
    fontSize: theme.fontSize.xs,

    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  addBarcodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1,

    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.full,
  },
  addBarcodeChipText: {
    fontSize: theme.fontSize.xs,

  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,

    borderRadius: theme.borderRadius.full,
  },
  metaChipText: {
    fontSize: theme.fontSize.xs,

  },
  // Quick Action Buttons - Round
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: theme.spacing.xs,
  },
  quickActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 56,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: theme.fontWeight.medium,
    marginTop: 3,
  },
  quickActionBtnPrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 64,
  },
  quickActionLabelPrimary: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    marginTop: 3,
  },

  // Empty State
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,

    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  addBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },

  // Bottom Bar
  clearBtn: {
    padding: theme.spacing.xs,
  },
  bottomBar: {
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 23 : 25, // Space for tab bar
    borderTopWidth: 1,

  },
  headerTitleWrap: {
    flex: 1,
  },

// Category Filter
categoryFilterContainer: {
paddingHorizontal: theme.spacing.md,
paddingVertical: theme.spacing.sm,

borderBottomWidth: 1,

},
categoryHeaderRow: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
marginBottom: theme.spacing.sm,
},
categoryLabel: {
fontSize: theme.fontSize.sm,
fontWeight: theme.fontWeight.medium,

},
manageCategoriesBtn: {
flexDirection: 'row',
alignItems: 'center',
gap: 4,
paddingVertical: 4,
paddingHorizontal: 8,
borderRadius: theme.borderRadius.sm,

},
manageCategoriesText: {
fontSize: theme.fontSize.xs,
fontWeight: theme.fontWeight.medium,

},
categoryChipsRow: {
flexDirection: 'row',
gap: theme.spacing.xs,
paddingRight: theme.spacing.md,
},
categoryChip: {
flexDirection: 'row',
alignItems: 'center',
gap: 4,
paddingVertical: 6,
paddingHorizontal: theme.spacing.sm,
borderRadius: theme.borderRadius.full,

borderWidth: 1,

},
categoryChipActive: {
  },
categoryChipText: {
fontSize: theme.fontSize.xs,
fontWeight: theme.fontWeight.medium,

},
categoryChipTextActive: {
  },
categoryDot: {
width: 8,
height: 8,
borderRadius: 4,
},
addCategoryPrompt: {
flexDirection: 'row',
alignItems: 'center',
gap: theme.spacing.xs,
paddingVertical: theme.spacing.sm,
},
addCategoryPromptText: {
fontSize: theme.fontSize.sm,

},
clearFilterBtn: {
flexDirection: 'row',
alignItems: 'center',
gap: 4,
alignSelf: 'flex-start',
paddingVertical: theme.spacing.xs,
marginTop: theme.spacing.xs,
},
clearFilterText: {
fontSize: theme.fontSize.xs,

},
emptyFilterResult: {
alignItems: 'center',
justifyContent: 'center',
paddingVertical: theme.spacing.xxl,
},
emptyFilterText: {
fontSize: theme.fontSize.md,

marginTop: theme.spacing.sm,
},

  // Selection Mode
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,

    gap: theme.spacing.md,
  },
  selectionBackBtn: {
    padding: theme.spacing.xs,
  },
  selectionHeaderTitle: {
    flex: 1,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  selectionHeaderActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  selectAllBtn: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: theme.borderRadius.sm,
  },
  selectAllText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  itemCardSelected: {

    borderWidth: 2,

  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  checkboxSelected: {
  },
  selectionBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,

    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing.md,
    borderTopWidth: 1,

    ...theme.shadow.lg,
  },
  selectionBottomTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.sm,
  },
  selectionCategoryChips: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  selectionCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.full,
    borderWidth: 1,

  },
  selectionCategoryChipText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  removeCategoryChip: {
  },
  // Warehouse Selector
  warehouseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

  },
  warehouseSelectorText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  // Warehouse Modal
  warehouseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  warehouseModal: {

    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  warehouseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  warehouseModalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  warehouseList: {
    padding: theme.spacing.md,
  },
  warehouseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

  },
  warehouseItemActive: {
  },
  warehouseItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  warehouseItemInfo: {
    flex: 1,
  },
  warehouseItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  warehouseItemNameActive: {
  },
  warehouseItemLocation: {
    fontSize: theme.fontSize.sm,

    marginTop: 2,
  },
  // Add Quantity Modal
  addQtyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addQtyModalContent: {
    width: '85%',

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  addQtyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  addQtyModalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  addQtyModalItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.md,
  },
  addQtyModalLabel: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.sm,
  },
  addQtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  addQtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,

    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },
  addQtyInputContainer: {
    width: 80,
    height: 50,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },
  addQtyInputText: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  addQtyModalNote: {
    fontSize: theme.fontSize.xs,

    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  addQtyModalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  addQtyModalCancelBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  addQtyModalCancelText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  addQtyModalConfirmBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  addQtyModalConfirmText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  addQtyModalBtnDisabled: {
    opacity: 0.6,
  },
  itemThumbnail: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  itemThumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,

    borderRadius: theme.borderRadius.sm,
  },
  galleryButtonText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,

  },
  galleryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryModalContent: {
    width: '100%',
    maxHeight: '90%',
    padding: theme.spacing.lg,
  },
  galleryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  galleryModalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    flex: 1,
  },
  galleryImage: {
    width: '100%',
    height: 400,
    borderRadius: theme.borderRadius.md,
  },
});
