import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Slider from '@react-native-community/slider';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { PercentageSlider } from './PercentageSlider';

export interface PickableItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  imageS3Key?: string;
}

export interface SelectedItem {
  item: PickableItem;
  selectedQuantity: number;
  percentage?: number;
}

export interface InventoryItemPickerProps {
  visible: boolean;
  onClose: () => void;
  items: PickableItem[];
  selectedItems: SelectedItem[];
  onConfirm: (selected: SelectedItem[]) => void;
  title?: string;
  multiSelect?: boolean;
  showQuantitySelector?: boolean;
  categories?: Array<{ id: string; name: string; color: string }>;
  compact?: boolean;
  onAddNew?: () => void;
}

export const InventoryItemPicker: React.FC<InventoryItemPickerProps> = ({
  visible,
  onClose,
  items,
  selectedItems: initialSelected,
  onConfirm,
  title = 'Select Items',
  multiSelect: _multiSelect = true,
  showQuantitySelector = true,
  categories = [],
  compact = false,
  onAddNew,
}) => {
  const {colors} = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tempSelected, setTempSelected] = useState<Map<string, SelectedItem>>(
    () => new Map(initialSelected.map(s => [s.item.id, s]))
  );

  const filteredItems = useMemo(() => {
    let result = items;
    
    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [items, searchQuery, selectedCategory]);

  const toggleItem = useCallback((item: PickableItem) => {
    setTempSelected(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        if (expandedId === item.id) {
          setExpandedId(null);
        }
      } else {
        const qty = Math.min(item.quantity, 1);
        const pct = (qty / item.quantity) * 100;
        next.set(item.id, { item, selectedQuantity: qty, percentage: pct });
        setExpandedId(item.id);
      }
      return next;
    });
  }, [expandedId]);

  const updatePercentage = useCallback((itemId: string, percentage: number, maxQty: number) => {
    setTempSelected(prev => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing) {
        const qty = Math.ceil((percentage / 100) * maxQty);
        next.set(itemId, { ...existing, selectedQuantity: qty, percentage });
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(tempSelected.values()));
    onClose();
  }, [tempSelected, onConfirm, onClose]);

  const handleClose = useCallback(() => {
    setTempSelected(new Map(initialSelected.map(s => [s.item.id, s])));
    onClose();
  }, [initialSelected, onClose]);

  const renderItem = useCallback(({ item }: { item: PickableItem }) => {
    const selected = tempSelected.get(item.id);
    const isSelected = !!selected;
    const isExpanded = expandedId === item.id;

    return (
      <View style={[styles.itemCard, {backgroundColor: colors.surface}, isSelected && [styles.itemCardSelected, {borderColor: colors.accent}]]}>
        <TouchableOpacity
          style={[styles.itemHeader, {backgroundColor: colors.surface}]}
          onPress={() => toggleItem(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isSelected && [styles.checkboxActive, {backgroundColor: colors.accent}]]}>
            {isSelected && <Icon name="check" size={14} color={colors.textLight} />}
          </View>

          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, {color: colors.text}]} numberOfLines={1}>{item.name}</Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemQty, {color: colors.textSecondary}]}>{item.quantity} in stock</Text>
              <Text style={[styles.itemPrice, {color: colors.textSecondary}]}>${item.price.toFixed(2)} ea</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isSelected && isExpanded && showQuantitySelector && (
          <View style={[styles.quantitySection, {backgroundColor: colors.background}]}>
            <Text style={[styles.quantityLabel, {color: colors.textSecondary}]}>How much to add?</Text>
            <PercentageSlider
              value={selected?.percentage || 100}
              maxQty={item.quantity}
              onChange={(pct: number) => updatePercentage(item.id, pct, item.quantity)}
              usedLabel="Adding"
              remainingLabel="Available"
            />
          </View>
        )}

        {isSelected && !isExpanded && showQuantitySelector && (
          <TouchableOpacity
            style={[styles.collapsedSummary, {borderTopColor: colors.border}]}
            onPress={() => setExpandedId(item.id)}
          >
            <Text style={[styles.collapsedSummaryText, {color: colors.text}]}>
              Adding {selected?.selectedQuantity} ({selected?.percentage?.toFixed(0)}%)
            </Text>
            <Icon name="edit-2" size={14} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [tempSelected, expandedId, toggleItem, updatePercentage, showQuantitySelector]);

  const selectedCount = tempSelected.size;

  // Compact mode - collapsible items with slider (same as JobCompletionModal)
  if (compact) {
    const totalSelected = Array.from(tempSelected.values()).reduce((sum, s) => sum + s.selectedQuantity, 0);
    
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.compactOverlay}>
          <View style={[styles.compactContent, {backgroundColor: colors.surface}]}>
            {/* Header */}
            <View style={[styles.compactHeader, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
              <View style={styles.compactHeaderLeft}>
                <Text style={[styles.compactTitle, {color: colors.text}]}>{title}</Text>
                <Text style={[styles.compactSubtitle, {color: colors.textSecondary}]}>{items.length} items available</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={[styles.compactCloseBtn, {backgroundColor: colors.background, borderRadius: theme.borderRadius.full}]}>
                <Icon name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.compactSearchContainer, {backgroundColor: colors.background}]}>
              <Icon name="search" size={16} color={colors.textSecondary} />
              <TextInput                 style={[styles.compactSearchInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search..."
                placeholderTextColor={colors.textSecondary}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="x-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Items List - Collapsible with Slider */}
            <View style={styles.compactItemsList}>
              <ScrollView
                style={styles.compactScrollView}
                contentContainerStyle={styles.compactScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {filteredItems.length === 0 ? (
                  <View style={styles.compactEmpty}>
                    <Icon name="package" size={32} color={colors.textSecondary} />
                    <Text style={[styles.compactEmptyText, {color: colors.textSecondary}, { marginTop: 8 }]}>
                      {items.length === 0 ? 'No inventory items yet' : 'No items match your search'}
                    </Text>
                    {items.length === 0 && onAddNew && (
                      <TouchableOpacity
                        style={[styles.compactAddNewBtn, { backgroundColor: colors.accent }]}
                        onPress={() => { onClose(); onAddNew(); }}
                      >
                        <Icon name="plus" size={16} color={colors.textLight} />
                        <Text style={[styles.compactAddNewText, { color: colors.textLight }]}>Add Inventory Item</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  filteredItems.map(item => {
                    const selected = tempSelected.get(item.id);
                    const isSelected = !!selected;
                    const isExpanded = expandedId === item.id;
                    const maxQty = item.quantity;
                    const selectedQty = selected?.selectedQuantity || 0;
                    const percentage = selected?.percentage || 0;

                    return (
                      <View key={item.id} style={[styles.compactItemCard, {backgroundColor: colors.surface, borderColor: colors.border}, isSelected && [styles.compactItemCardSelected, {borderColor: colors.accent}]]}>
                        <TouchableOpacity
                          style={[styles.compactItemHeader, {backgroundColor: colors.surface}]}
                          onPress={() => {
                            if (isSelected) {
                              setExpandedId(isExpanded ? null : item.id);
                            } else {
                              toggleItem(item);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.compactItemHeaderLeft}>
                            {isSelected ? (
                              <Icon
                                name={isExpanded ? "chevron-down" : "chevron-right"}
                                size={14}
                                color={colors.textSecondary}
                              />
                            ) : (
                              <View style={styles.compactAddIcon}>
                                <Icon name="plus" size={12} color={colors.accent} />
                              </View>
                            )}
                            <Text style={[styles.compactItemTitle, {color: colors.text}]} numberOfLines={1}>
                              {item.name}
                            </Text>
                          </View>
                          <View style={styles.compactItemHeaderRight}>
                            {isSelected ? (
                              <>
                                <Text style={[styles.compactItemPercent, {color: colors.textSecondary}]}>{Math.round(percentage)}%</Text>
                                <Text style={[styles.compactItemUsed, {color: colors.textSecondary}]}>{selectedQty}/{maxQty}</Text>
                              </>
                            ) : (
                              <Text style={[styles.compactItemStock, {color: colors.textSecondary}]}>{maxQty} avail</Text>
                            )}
                          </View>
                        </TouchableOpacity>

                        {isSelected && isExpanded && (
                          <View style={[styles.compactSliderWrap, {backgroundColor: colors.background}]}>
                            <Slider
                              style={styles.compactSlider}
                              minimumValue={0}
                              maximumValue={100}
                              step={maxQty > 20 ? 5 : Math.round(100 / maxQty)}
                              value={percentage}
                              onValueChange={(v) => updatePercentage(item.id, Math.round(v), maxQty)}
                              minimumTrackTintColor={colors.accent}
                              maximumTrackTintColor={colors.border}
                              thumbTintColor={colors.accent}
                            />
                            <TouchableOpacity
                              style={[styles.compactRemoveBtn, {backgroundColor: `${colors.error}15`, borderRadius: theme.borderRadius.full}]}
                              onPress={() => toggleItem(item)}
                            >
                              <Icon name="trash-2" size={14} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Footer */}
            <View style={[styles.compactFooter, {borderTopColor: colors.border, backgroundColor: colors.surface}]}>
              <Text style={[styles.compactTotalText, {color: colors.text}]}>
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} • Qty: {totalSelected}
              </Text>
              <View style={styles.compactActions}>
                <TouchableOpacity style={[styles.compactCancelBtn, {backgroundColor: colors.surface}]} onPress={handleClose}>
                  <Text style={[styles.compactCancelText, {color: colors.textSecondary}]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity                   style={[styles.compactConfirmBtn, {backgroundColor: colors.accent}, selectedCount === 0 && [styles.compactConfirmBtnDisabled, {opacity: 0.5}]]}
                  onPress={handleConfirm}
                  disabled={selectedCount === 0}
                >
                  <Icon name="plus" size={16} color={colors.textLight} />
                  <Text style={[styles.compactConfirmText, {color: colors.textLight}]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible}  animationType="fade" onRequestClose={handleClose}>
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        {/* Header */}
        <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="x" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
          <TouchableOpacity onPress={handleConfirm}>
            <Text style={[styles.confirmText, {color: colors.accent}]}>
              Done {selectedCount > 0 && `(${selectedCount})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, {backgroundColor: colors.background}]}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput             style={[styles.searchInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search items..."
            placeholderTextColor={colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        {categories.length > 0 && (
          <View style={styles.categoryFilter}>
            <TouchableOpacity               style={[styles.categoryChip, {backgroundColor: colors.surface, borderColor: colors.border}, !selectedCategory && [styles.categoryChipActive, {backgroundColor: colors.accent, borderColor: colors.accent}]]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, {color: colors.textSecondary}, !selectedCategory && [styles.categoryChipTextActive, {color: colors.textLight}]]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {backgroundColor: colors.surface, borderColor: colors.border},
                  selectedCategory === cat.name && [styles.categoryChipActive, {backgroundColor: colors.accent, borderColor: colors.accent}],
                ]}
                onPress={() => setSelectedCategory(cat.name)}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text
                  style={[
                    styles.categoryChipText,
                    {color: colors.textSecondary},
                    selectedCategory === cat.name && [styles.categoryChipTextActive, {color: colors.textLight}],
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
              <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
                {items.length === 0 ? 'No inventory items yet' : 'No items found'}
              </Text>
              {items.length === 0 && onAddNew ? (
                <TouchableOpacity
                  style={[styles.addNewBtn, { backgroundColor: colors.accent }]}
                  onPress={() => { onClose(); onAddNew(); }}
                >
                  <Icon name="plus" size={18} color={colors.textLight} />
                  <Text style={[styles.addNewBtnText, {color: colors.accent}]}>Add Inventory Item</Text>
                </TouchableOpacity>
              ) : searchQuery ? (
                <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>Try a different search term</Text>
              ) : null}
            </View>
          }
        />

        {/* Selected Summary + Confirm Button */}
        {selectedCount > 0 && (
          <View style={[styles.summaryBar, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryText, {color: colors.textSecondary}]}>
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </Text>
              <Text style={[styles.summaryTotal, {color: colors.text}]}>
                ${Array.from(tempSelected.values())
                  .reduce((sum, s) => sum + s.item.price * s.selectedQuantity, 0)
                  .toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmBtn, {backgroundColor: colors.accent}]}
              onPress={() => {
                onConfirm(Array.from(tempSelected.values()));
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmBtnText, {color: colors.textLight}]}>
                Add Items
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
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
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

  },
  confirmText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,

    paddingVertical: 0,
  },
  categoryFilter: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,

    borderRadius: theme.borderRadius.full,
    borderWidth: 1,

  },
  categoryChipActive: {
  },
  categoryChipText: {
    fontSize: theme.fontSize.sm,

  },
  categoryChipTextActive: {

    fontWeight: theme.fontWeight.medium,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  itemCard: {

    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,

    overflow: 'hidden',
  },
  itemCardSelected: {
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  itemMeta: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: 4,
  },
  itemQty: {
    fontSize: theme.fontSize.sm,

  },
  itemPrice: {
    fontSize: theme.fontSize.sm,

  },
  quantitySection: {
    padding: theme.spacing.md,
    paddingTop: 0,
    borderTopWidth: 1,

  },
  quantityLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  collapsedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,

    borderTopWidth: 1,

  },
  collapsedSummaryText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  addNewBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  summaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  summaryTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
  },
  confirmBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginLeft: theme.spacing.md,
  },
  confirmBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },

  // Compact Mode Styles (same pattern as JobCompletionModal)
  compactOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  compactContent: {

    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  compactHeaderLeft: {
    flex: 1,
  },
  compactTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  compactSubtitle: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  compactCloseBtn: {
    padding: theme.spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,

    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  compactSearchInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,

    paddingVertical: 4,
  },
  compactItemsList: {
    minHeight: 180,
    maxHeight: 280,
  },
  compactScrollView: {
    flex: 1,
  },
  compactScrollContent: {
    padding: theme.spacing.md,
  },
  compactItemCard: {

    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    minHeight: 44,
  },
  compactItemCardSelected: {
    borderWidth: 1,

  },
  compactItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  compactItemHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  compactItemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  compactAddIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',
  },
  compactItemTitle: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  compactItemPercent: {
    fontSize: theme.fontSize.xs,

    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactItemUsed: {
    fontSize: theme.fontSize.xs,

    fontWeight: theme.fontWeight.semibold,
  },
  compactItemStock: {
    fontSize: theme.fontSize.xs,

  },
  compactSliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  compactSlider: {
    flex: 1,
    height: 32,
  },
  compactRemoveBtn: {
    padding: theme.spacing.xs,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactEmpty: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  compactEmptyText: {
    fontSize: theme.fontSize.sm,

  },
  compactFooter: {
    borderTopWidth: 1,

    padding: theme.spacing.md,
  },
  compactTotalText: {
    fontSize: theme.fontSize.xs,

    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  compactActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  compactCancelBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,

  },
  compactCancelText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  compactConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,

    gap: theme.spacing.xs,
  },
  compactConfirmBtnDisabled: {
  },
  compactConfirmText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },
  compactAddNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  compactAddNewText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
});

export default InventoryItemPicker;
