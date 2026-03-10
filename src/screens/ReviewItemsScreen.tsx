import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  type ListRenderItemInfo,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Button } from '../components/Button';
import { ScreenHeader, AnimatedPressable, ConfirmationModal } from '../components/ui';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import type { ReviewItemsScreenProps, InventoryItem } from '../types/navigation';

interface CollapsibleItemCardProps {
  item: InventoryItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onDelete: (id: string) => void;
  onScanBarcode: (id: string) => void;
}

const CollapsibleItemCard = memo<CollapsibleItemCardProps>(
  ({ item, isExpanded, onToggle, onUpdateQuantity, onUpdatePrice, onDelete, onScanBarcode }) => {
    const { colors } = useTheme();
    // Local state for input text to allow free typing
    const [quantityText, setQuantityText] = useState(item.quantity.toString());
    const [priceText, setPriceText] = useState(item.price.toFixed(2));

    // Sync local state when item changes from parent (e.g., initial load)
    useEffect(() => {
      setQuantityText(item.quantity.toString());
      setPriceText(item.price.toFixed(2));
    }, [item.id]); // Only sync on item id change, not on every price/quantity change

    const handleQuantityChange = useCallback(
      (text: string) => {
        setQuantityText(text);
      },
      [],
    );

    const handleQuantityBlur = useCallback(() => {
      const value = parseInt(quantityText, 10);
      const finalValue = isNaN(value) || value < 0 ? 0 : value;
      onUpdateQuantity(item.id, finalValue);
      setQuantityText(finalValue.toString());
    }, [item.id, quantityText, onUpdateQuantity]);

    const handlePriceChange = useCallback(
      (text: string) => {
        setPriceText(text);
      },
      [],
    );

    const handlePriceBlur = useCallback(() => {
      const value = parseFloat(priceText.replace(',', '.'));
      const finalValue = isNaN(value) || value < 0 ? 0 : value;
      onUpdatePrice(item.id, finalValue);
      setPriceText(finalValue.toFixed(2));
    }, [item.id, priceText, onUpdatePrice]);

    const handleDelete = useCallback(() => {
      onDelete(item.id);
    }, [item.id, onDelete]);

    const handleScan = useCallback(() => {
      onScanBarcode(item.id);
    }, [item.id, onScanBarcode]);

    const handleToggle = useCallback(() => {
      onToggle(item.id);
    }, [item.id, onToggle]);

    const formattedDate = useMemo(() => {
      if (!item.purchaseDate) return null;
      try {
        return new Date(item.purchaseDate).toLocaleDateString();
      } catch {
        return item.purchaseDate;
      }
    }, [item.purchaseDate]);

    const itemTotal = item.price * item.quantity;

    return (
      <View style={[styles.itemCard, {backgroundColor: colors.surface}]}>
        {/* Collapsed Header - Always visible */}
        <TouchableOpacity           style={[styles.collapsedHeader, {backgroundColor: colors.surface}]}
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <View style={styles.collapsedInfo}>
            <Text style={[styles.itemName, {color: colors.text}]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.collapsedMeta}>
              <Text style={[styles.collapsedMetaText, {color: colors.textSecondary}]}>
                {item.quantity}x ${item.price.toFixed(2)}
              </Text>
              <Text style={[styles.collapsedTotal, {color: colors.text}]}>
                ${itemTotal.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {/* Delete button only visible when expanded */}
            {isExpanded && (
              <TouchableOpacity                 onPress={handleDelete}
                style={[styles.deleteButton, {backgroundColor: `${colors.error}10`}]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="x" size={14} color={colors.surface} />
              </TouchableOpacity>
            )}
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={[styles.expandedContent, {borderTopColor: colors.divider}]}>
            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, {color: colors.textSecondary}]}>Quantity</Text>
                <TextInput
                  style={[styles.input, {borderColor: colors.border, color: colors.text, backgroundColor: colors.background}]}
                  value={quantityText}
                  onChangeText={handleQuantityChange}
                  onBlur={handleQuantityBlur}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  selectTextOnFocus
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, {color: colors.textSecondary}]}>Price ($)</Text>
                <TextInput
                  style={[styles.input, {borderColor: colors.border, color: colors.text, backgroundColor: colors.background}]}
                  value={priceText}
                  onChangeText={handlePriceChange}
                  onBlur={handlePriceBlur}
                  keyboardType="numbers-and-punctuation"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  selectTextOnFocus
                />
              </View>
            </View>

            {(item.store || formattedDate) && (
              <View style={styles.metaContainer}>
                {item.store && (
                  <Text style={[styles.metaText, {color: colors.textSecondary}]}>Store: {item.store}</Text>
                )}
                {formattedDate && (
                  <Text style={[styles.metaText, {color: colors.textSecondary}]}>Date: {formattedDate}</Text>
                )}
              </View>
            )}

            <Button
              title={item.barcode ? `Barcode: ${item.barcode}` : 'Scan Barcode'}
              onPress={handleScan}
              variant="outline"
              style={styles.barcodeButton}
            />

            {/* Return Deadline Field - Feature #4 */}
            {/* TODO: Backend integration - currently local only */}
            <View style={[styles.returnDateContainer, {backgroundColor: colors.surface}]}>
              <View style={styles.returnDateHeader}>
                <Icon name="calendar" size={14} color={colors.warning} />
                <Text style={[styles.returnDateLabel, {color: colors.text}]}>Return Deadline</Text>
              </View>
              {item.returnDeadline ? (
                <Text style={[styles.returnDateValue, {color: colors.text}]}>
                  {new Date(item.returnDeadline).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              ) : (
                <Text style={[styles.returnDateEmpty, {color: colors.textSecondary}]}>
                  No return deadline set
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  },
);

CollapsibleItemCard.displayName = 'CollapsibleItemCard';

const EmptyList = memo(() => {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
      <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No materials to review</Text>
    </View>
  );
});

EmptyList.displayName = 'EmptyList';

export const ReviewItemsScreen: React.FC<ReviewItemsScreenProps> = ({
  route,
  navigation,
}) => {
  const [items, setItems] = useState<InventoryItem[]>(route.params.items);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { colors, isDark } = useTheme();

  // Sync items when route params change (e.g., when adding more materials)
  useEffect(() => {
    setItems(route.params.items);
  }, [route.params.items]);

  // Modal states
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
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

  const updateItemQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, quantity } : item)),
    );
  }, []);

  const updateItemPrice = useCallback((id: string, price: number) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, price } : item)),
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Barcode scanning disabled
  const handleScanBarcode = useCallback(
    (_itemId: string) => {
      // navigation.navigate('BarcodeScanner', { ... });
    },
    [],
  );

  const { addItems } = useInventory();

  const handleSaveItems = useCallback(async () => {
    if (items.length === 0) {
      setErrorMessage('Please add at least one material');
      setErrorModalVisible(true);
      return;
    }

    setIsSaving(true);

    try {
      // Add items to inventory context (local storage)
      addItems(items);
      console.log('[Inventory] Items added to inventory:', items.length);

      // Navigate directly to Inventory tab (no confirmation modal)
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'InventoryTab' } }],
      });
    } catch (error) {
      console.error('[Inventory] Error saving items:', error);
      setErrorMessage('Failed to save materials. Please try again.');
      setErrorModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  }, [items, addItems, navigation]);

  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<InventoryItem>) => (
      <CollapsibleItemCard
        item={item}
        isExpanded={expandedIds.has(item.id)}
        onToggle={toggleItem}
        onUpdateQuantity={updateItemQuantity}
        onUpdatePrice={updateItemPrice}
        onDelete={deleteItem}
        onScanBarcode={handleScanBarcode}
      />
    ),
    [expandedIds, toggleItem, updateItemQuantity, updateItemPrice, deleteItem, handleScanBarcode],
  );

  const keyExtractor = useCallback((item: InventoryItem) => item.id, []);

  const ListHeader = useMemo(
    () => items.length > 0 ? (
      <View style={styles.listHeader}>
        <AnimatedPressable style={[styles.toggleAllBtn, {backgroundColor: colors.surface}]} onPress={toggleAll}>
          <Icon
            name={allExpanded ? 'minimize-2' : 'maximize-2'}
            size={16}
            color={colors.accent}
          />
          <Text style={[styles.toggleAllText, {color: colors.accent}]}>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Text>
        </AnimatedPressable>
      </View>
    ) : null,
    [items.length, allExpanded, toggleAll, colors],
  );

  // Navigate to add more materials - pass existing items to merge later
  const handleAddMore = useCallback(() => {
    navigation.navigate('AddInventory', { existingItems: items });
  }, [navigation, items]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Review Materials"
        subtitle={`${items.length} material${items.length !== 1 ? 's' : ''} • $${totalValue.toFixed(2)}`}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={[styles.addHeaderBtn, {backgroundColor: colors.accent}]}
            onPress={handleAddMore}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="plus" size={22} color={colors.textLight} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyList}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      <View style={[styles.footer, {borderTopColor: colors.border}]}>
        <Button
          title="Save Materials"
          onPress={handleSaveItems}
          loading={isSaving}
          disabled={items.length === 0}
        />
      </View>

      {/* Error Modal */}
      <ConfirmationModal
        visible={errorModalVisible}
        title="Error"
        message={errorMessage}
        icon="alert-circle"
        iconColor={colors.error}
        buttons={[
          { text: 'OK', onPress: () => setErrorModalVisible(false) },
        ]}
      />

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  listContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },

  // List Header with Toggle All
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.md,
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

  // Add Header Button
  addHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,

    justifyContent: 'center',
    alignItems: 'center',
  },

  // Collapsible Item Card
  itemCard: {

    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  collapsedInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.xs,
  },
  collapsedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  collapsedMetaText: {
    fontSize: theme.fontSize.sm,

  },
  collapsedTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,

  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,

    justifyContent: 'center',
    alignItems: 'center',
  },

  // Expanded Content
  expandedContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,

    paddingTop: theme.spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  input: {
    borderWidth: 1.5,

    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    fontSize: theme.fontSize.md,

  },
  metaContainer: {
    marginBottom: theme.spacing.sm,
  },
  metaText: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.xs,
  },
  barcodeButton: {
    marginTop: theme.spacing.xs,
  },

  // Return Date Styles
  returnDateContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,

    borderRadius: theme.borderRadius.sm,
    borderLeftWidth: 3,

  },
  returnDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  returnDateLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  returnDateValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  returnDateEmpty: {
    fontSize: theme.fontSize.sm,

    fontStyle: 'italic',
  },

  // Empty State
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.md,

  },

  // Footer
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,

  },
});
