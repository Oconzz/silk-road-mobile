import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import { useJob } from '../context/JobContext';
import Slider from '@react-native-community/slider';
import { ScreenHeader, AnimatedPressable, CategoryBadge } from '../components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, InventoryItem } from '../types/navigation';

interface SelectedItem {
  item: InventoryItem;
  percentage: number; // 0-100
  quantity: number;
}

interface RouteParams {
  onSelectItems?: (items: SelectedItem[]) => void;
}

export const SelectInventoryForJobScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const params = route.params as RouteParams | undefined;
  const { colors } = useTheme();

  const { items, customCategories } = useInventory();
  const { createJob } = useJob();
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(item => item.category === selectedCategory);
  }, [items, selectedCategory]);

  // Toggle item selection
  const handleToggleItem = useCallback((item: InventoryItem) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        setExpandedId(null);
      } else {
        next.set(item.id, {
          item,
          percentage: 100,
          quantity: item.quantity,
        });
        setExpandedId(item.id);
      }
      return next;
    });
  }, []);

  // Update percentage for selected item
  const handleUpdatePercentage = useCallback((itemId: string, percentage: number, maxQty: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing) {
        const quantity = Math.round((percentage / 100) * maxQty);
        next.set(itemId, { ...existing, percentage, quantity });
      }
      return next;
    });
  }, []);

  // Confirm selection - either callback or create job directly
  const handleConfirm = useCallback(async () => {
    const selected = Array.from(selectedItems.values());
    
    if (params?.onSelectItems) {
      // Called from CreateJobScreen - just return selections
      params.onSelectItems(selected);
      navigation.goBack();
    } else {
      // Called from InventoryScreen - create job directly with materials
      // Convert selected items to jobInventory format for backend
      // Backend expects productId and warehouseId, not inventoryId
      // Filter out items without warehouseId (shouldn't happen but for type safety)
      const jobInventory = selected
        .filter(sel => sel.item.warehouseId)
        .map(sel => ({
          productId: sel.item.productId || sel.item.id,
          warehouseId: sel.item.warehouseId!,
          inventoryId: sel.item.id,
          idealQuantity: sel.quantity,
          actualQuantity: 0,
          price: sel.item.price || 0,
          title: sel.item.title || sel.item.name || '',
          description: sel.item.description || '',
        }));
      
      const newJob = await createJob({
        title: `Job from ${selected.length} material${selected.length > 1 ? 's' : ''}`,
        description: `Created from inventory with ${selected.length} materials`,
        status: 'draft',
        jobInventory,
      });
      
      // Navigate to the new job
      navigation.reset({
        index: 1,
        routes: [
          { name: 'MainTabs', state: { routes: [{ name: 'HomeTab' }, { name: 'JobsTab' }, { name: 'EstimatesTab' }, { name: 'InventoryTab' }], index: 1 } },
          { name: 'JobDetail', params: { jobId: newJob.id } },
        ],
      });
    }
  }, [selectedItems, params, navigation, createJob]);

  // Render category filter
  const CategoryFilter = useMemo(() => (
    <View style={[styles.categoryFilter, {borderBottomColor: colors.border}]}>
      <TouchableOpacity
        style={[
          styles.categoryChip,
          !selectedCategory && [styles.categoryChipActive, {backgroundColor: colors.accent}],
        ]}
        onPress={() => setSelectedCategory(null)}
      >
        <Text style={[
          styles.categoryChipText,
          !selectedCategory && [styles.categoryChipTextActive, {color: colors.textLight}],
        ]}>
          All
        </Text>
      </TouchableOpacity>
      {customCategories.slice(0, 6).map(cat => (
        <TouchableOpacity
          key={cat.id}
          style={[
            styles.categoryChip,
            selectedCategory === cat.name && [styles.categoryChipActive, {backgroundColor: colors.accent}],
          ]}
          onPress={() => setSelectedCategory(cat.name === selectedCategory ? null : cat.name)}
        >
          <Text style={[
            styles.categoryChipText,
            selectedCategory === cat.name && [styles.categoryChipTextActive, {color: colors.textLight}],
          ]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [selectedCategory, customCategories]);

  // Render item
  const renderItem = useCallback(({ item }: { item: InventoryItem }) => {
    const isSelected = selectedItems.has(item.id);
    const isExpanded = expandedId === item.id;
    const selectedData = selectedItems.get(item.id);

    return (
      <View style={[styles.itemCard, {backgroundColor: colors.surface}, isSelected && [styles.itemCardSelected, {borderColor: colors.accent}]]}>
        <TouchableOpacity
          style={[styles.itemHeader, {backgroundColor: colors.surface}]}
          onPress={() => handleToggleItem(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Icon name="check" size={14} color={colors.textLight} />}
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, {color: colors.text}]} numberOfLines={1}>{item.name}</Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemQty, {color: colors.textSecondary}]}>{item.quantity} available</Text>
              <Text style={[styles.itemPrice, {color: colors.textSecondary}]}>${item.price.toFixed(2)} ea</Text>
            </View>
            {item.category && (
              <CategoryBadge category={item.category} compact />
            )}
          </View>
        </TouchableOpacity>

        {/* Compact Slider - shown when selected */}
        {isSelected && isExpanded && (
          <View style={[styles.compactSliderSection, {backgroundColor: colors.surface}]}>
            <Slider
              style={styles.compactSlider}
              minimumValue={0}
              maximumValue={100}
              step={item.quantity > 0 ? (100 / item.quantity) : 1}
              value={selectedData?.percentage || 100}
              onValueChange={(v: number) => handleUpdatePercentage(item.id, Math.round(v), item.quantity)}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
            />
          </View>
        )}

        {/* Collapsed summary when selected but not expanded */}
        {isSelected && !isExpanded && (
          <TouchableOpacity
            style={styles.collapsedSummary}
            onPress={() => setExpandedId(item.id)}
          >
            <Text style={[styles.collapsedSummaryText, {color: colors.text}]}>
              Using {selectedData?.quantity} ({selectedData?.percentage}%)
            </Text>
            <Icon name="edit-2" size={14} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [selectedItems, expandedId, handleToggleItem, handleUpdatePercentage]);

  const selectedCount = selectedItems.size;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Add Materials to Job"
        subtitle={`${items.length} items available`}
        onBack={() => navigation.goBack()}
      />

      {/* Category Filter */}
      {CategoryFilter}

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="package" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, {color: colors.text}]}>No Materials</Text>
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
            {selectedCategory
              ? `No materials in "${selectedCategory}" category`
              : 'Add materials to your inventory first'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Bar */}
      {selectedCount > 0 && (
        <View style={[styles.bottomBar, {backgroundColor: colors.surface}]}>
          <View style={styles.bottomBarInfo}>
            <Text style={[styles.bottomBarCount, {color: colors.text}]}>{selectedCount} items selected</Text>
            <Text style={[styles.bottomBarTotal, {color: colors.text}]}>
              Total: ${Array.from(selectedItems.values())
                .reduce((sum, s) => sum + (s.item.price * s.quantity), 0)
                .toFixed(2)}
            </Text>
          </View>
          <AnimatedPressable style={[styles.confirmBtn, {backgroundColor: colors.accent}]} onPress={handleConfirm}>
            <Icon name="check" size={18} color={colors.textLight} />
            <Text style={[styles.confirmBtnText, {color: colors.text}]}>Add to Job</Text>
          </AnimatedPressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },

  // Category Filter
  categoryFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  categoryChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
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

  // Item Card
  itemCard: {

    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.sm,
  },
  itemCardSelected: {
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  checkboxChecked: {
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: 4,
  },
  itemQty: {
    fontSize: theme.fontSize.sm,

  },
  itemPrice: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },

  // Compact Slider Section
  compactSliderSection: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderTopWidth: 1,

  },
  compactSlider: {
    width: '100%',
    height: 32,
  },
  quantitySummary: {
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  quantitySummaryText: {
    fontSize: theme.fontSize.sm,

  },
  quantityValue: {
    fontWeight: theme.fontWeight.bold,

  },

  // Collapsed Summary
  collapsedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,

  },
  collapsedSummaryText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing.md,

    borderTopWidth: 1,

    ...theme.shadow.md,
  },
  bottomBarInfo: {
    flex: 1,
  },
  bottomBarCount: {
    fontSize: theme.fontSize.sm,

  },
  bottomBarTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,

    borderRadius: theme.borderRadius.md,
  },
  confirmBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
});

export default SelectInventoryForJobScreen;
