import React, {useCallback, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useInventory} from '../context/InventoryContext';
import {useEstimate} from '../context/EstimateContext';
import {Button} from '../components/Button';
import {ScreenHeader, AnimatedPressable} from '../components/ui';
import type {SelectInventoryForEstimateScreenProps} from '../types/navigation';
import type {InventoryItem} from '../types/navigation';

// Inventory Item Card
interface InventoryCardProps {
  item: InventoryItem;
  isSelected: boolean;
  onToggle: () => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({item, isSelected, onToggle}) => {
  const { colors } = useTheme();
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <AnimatedPressable
      style={[styles.itemCard, isSelected && styles.itemCardSelected]}
      onPress={onToggle}>
      <View style={styles.checkbox}>
        {isSelected ? (
          <View style={styles.checkboxChecked}>
            <Icon name="check" size={14} color={colors.textLight} />
          </View>
        ) : (
          <View style={[styles.checkboxUnchecked, {borderColor: colors.border}]} />
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, {color: colors.text}]} numberOfLines={2}>{item.name}</Text>
        <View style={styles.itemDetails}>
          <Text style={[styles.itemQty, {color: colors.textSecondary}]}>Qty: {item.quantity}</Text>
          <Text style={[styles.itemPrice, {color: colors.textSecondary}]}>{formatCurrency(item.price)}</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
};

export const SelectInventoryForEstimateScreen: React.FC<SelectInventoryForEstimateScreenProps> = ({
  navigation,
}) => {
  const {items: inventoryItems} = useInventory();
  const {addFromInventory, draftEstimate} = useEstimate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) {return inventoryItems;}
    const query = searchQuery.toLowerCase();
    return inventoryItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [inventoryItems, searchQuery]);

  // Get items already in estimate
  const existingItemIds = useMemo(() => {
    if (!draftEstimate) {return new Set<string>();}
    return new Set(draftEstimate.lineItems.filter(item => item.inventoryId).map(item => item.inventoryId!));
  }, [draftEstimate]);

  // Toggle item selection
  const handleToggleItem = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Select all
  const handleSelectAll = useCallback(() => {
    const allIds = new Set(filteredItems.map(item => item.id));
    setSelectedIds(allIds);
  }, [filteredItems]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Add selected items to estimate
  const handleAddToEstimate = useCallback(() => {
    const selectedItems = inventoryItems.filter(item => selectedIds.has(item.id));
    addFromInventory(selectedItems);
    navigation.goBack();
  }, [inventoryItems, selectedIds, addFromInventory, navigation]);

  // Render item
  const renderItem = useCallback(({item}: {item: InventoryItem}) => {
    const isAlreadyAdded = existingItemIds.has(item.id);
    const isSelected = selectedIds.has(item.id);

    if (isAlreadyAdded) {
      return (
        <View style={[styles.itemCard, {backgroundColor: colors.surface}, styles.itemCardDisabled]}>
          <View style={styles.checkbox}>
            <View style={styles.checkboxDisabled}>
              <Icon name="check" size={14} color={colors.textSecondary} />
            </View>
          </View>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, {color: colors.text}, styles.itemNameDisabled]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.alreadyAddedText, {color: colors.text}]}>Already in estimate</Text>
          </View>
        </View>
      );
    }

    return (
      <InventoryCard
        item={item}
        isSelected={isSelected}
        onToggle={() => handleToggleItem(item.id)}
      />
    );
  }, [selectedIds, existingItemIds, handleToggleItem]);

  const selectedCount = selectedIds.size;

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="Add from Inventory"
        subtitle={`${inventoryItems.length} items available`}
        onBack={() => navigation.goBack()}
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, {backgroundColor: colors.background}]}>
        <View style={[styles.searchBar, {backgroundColor: colors.background}]}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput             style={[styles.searchInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
            placeholder="Search materials..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selection Actions */}
      <View style={styles.selectionActions}>
        <TouchableOpacity style={[styles.selectionButton, {backgroundColor: colors.accent}]} onPress={handleSelectAll}>
          <Text style={[styles.selectionButtonText, {color: colors.textLight}]}>Select All</Text>
        </TouchableOpacity>
        {selectedCount > 0 && (
          <TouchableOpacity style={[styles.selectionButton, {backgroundColor: colors.accent}]} onPress={handleClearSelection}>
            <Text style={[styles.selectionButtonText, {color: colors.textLight}]}>Clear ({selectedCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="package" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, {color: colors.text}]}>No Materials Found</Text>
            <Text style={[styles.emptySubtitle, {color: colors.text}]}>
              {searchQuery
                ? 'Try a different search term'
                : 'Add materials to your inventory first'}
            </Text>
          </View>
        }
      />

      {/* Bottom Bar */}
      {selectedCount > 0 && (
        <View style={[styles.bottomBar, {backgroundColor: colors.surface}]}>
          <View style={styles.selectedInfo}>
            <Text style={[styles.selectedCount, {color: colors.text}]}>{selectedCount}</Text>
            <Text style={[styles.selectedLabel, {color: colors.textSecondary}]}>items selected</Text>
          </View>
          <Button
            title="Add to Estimate"
            onPress={handleAddToEstimate}
            style={[styles.addButton, {backgroundColor: colors.accent}]}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },

  // Search
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    ...theme.shadow.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.md,

  },

  // Selection Actions
  selectionActions: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  selectionButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  selectionButtonText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },

  // List
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },

  // Item Card
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  itemCardSelected: {
    borderWidth: 2,

  },
  itemCardDisabled: {
    opacity: 0.6,
  },
  checkbox: {
    marginRight: theme.spacing.md,
  },
  checkboxUnchecked: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,

  },
  checkboxChecked: {
    width: 24,
    height: 24,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDisabled: {
    width: 24,
    height: 24,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginBottom: 4,
  },
  itemNameDisabled: {
  },
  itemDetails: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  itemQty: {
    fontSize: theme.fontSize.sm,

  },
  itemPrice: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },
  alreadyAddedText: {
    fontSize: theme.fontSize.sm,

    fontStyle: 'italic',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
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
    borderTopWidth: 1,

    ...theme.shadow.lg,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
  },
  selectedCount: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  selectedLabel: {
    fontSize: theme.fontSize.sm,

  },
  addButton: {
    paddingHorizontal: theme.spacing.lg,
  },
});
