import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category?: string;
}

export interface CategoryManagerModalProps {
  visible: boolean;
  onClose: () => void;
  categories: CustomCategory[];
  onAddCategory: (name: string, color?: string) => void;
  onRemoveCategory: (id: string) => void;
  inventoryItems?: InventoryItem[];
  onUpdateItemCategory?: (itemId: string, categoryName: string | undefined) => void;
  /** Callback to start batch selection mode in the parent screen */
  onStartBatchMode?: () => void;
}

const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  '#06B6D4', '#A855F7', '#F43F5E', '#22C55E', '#0EA5E9',
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  visible,
  onClose,
  categories,
  onAddCategory,
  onRemoveCategory,
  inventoryItems = [],
  onUpdateItemCategory: _onUpdateItemCategory,
  onStartBatchMode,
}) => {
  const {colors} = useTheme();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  
  // Animation for slide-up effect
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  const handleAddCategory = useCallback(() => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim(), selectedColor);
      setNewCategoryName('');
      setSelectedColor(PRESET_COLORS[(categories.length + 1) % PRESET_COLORS.length]);
    }
  }, [newCategoryName, selectedColor, onAddCategory, categories.length]);

  const itemsInCategory = useCallback((categoryName: string) => {
    return inventoryItems.filter(item => item.category === categoryName).length;
  }, [inventoryItems]);

  // Handle batch mode - close modal and trigger parent callback
  const handleStartBatchMode = useCallback(() => {
    onClose();
    onStartBatchMode?.();
  }, [onClose, onStartBatchMode]);

  const renderCategory = useCallback(({ item }: { item: CustomCategory }) => (
    <View style={[styles.categoryItem, {backgroundColor: colors.background, borderBottomColor: colors.border}]}>
      <View style={styles.categoryMainContent}>
        <View style={[styles.categoryColor, { backgroundColor: item.color }]} />
        <View style={styles.categoryNameContainer}>
          <Text style={[styles.categoryName, {color: colors.text}]}>{item.name}</Text>
          <Text style={[styles.categoryCount, {color: colors.textSecondary}]}>{itemsInCategory(item.name)} items</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.removeBtn, {backgroundColor: colors.error, borderRadius: 14}]}
        onPress={() => onRemoveCategory(item.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="x" size={16} color={colors.textLight} />
      </TouchableOpacity>
    </View>
  ), [onRemoveCategory, itemsInCategory, colors]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <Animated.View style={[styles.content, { transform: [{ translateY }], backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
            <Text style={[styles.title, {color: colors.text}]}>Manage Categories</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Batch Tagging Button - triggers selection mode in parent screen */}
          {onStartBatchMode && inventoryItems.length > 0 && (
            <TouchableOpacity 
              style={[styles.batchTagBtn, {backgroundColor: colors.background, borderColor: colors.border}]}
              onPress={handleStartBatchMode}
            >
              <Icon name="tag" size={20} color={colors.accent} />
              <View style={styles.batchTagBtnContent}>
                <Text style={[styles.batchTagBtnTitle, {color: colors.text}]}>Batch Tag Items</Text>
                <Text style={[styles.batchTagBtnSubtitle, {color: colors.textSecondary}]}>Select items and apply categories</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Add New Category */}
          <View style={[styles.addSection, {backgroundColor: colors.surface}, {borderBottomColor: colors.divider}]}>
            <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Add New Category</Text>
            <View style={styles.inputRow}>
              <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
              <TextInput
                style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Category name"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={handleAddCategory}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addBtn, {backgroundColor: colors.accent}, !newCategoryName.trim() && {opacity: 0.5}]}
                onPress={handleAddCategory}
                disabled={!newCategoryName.trim()}
              >
                <Icon name="plus" size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            {/* Color Picker */}
            <View style={styles.colorPicker}>
              {PRESET_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && [styles.colorOptionSelected, {borderColor: colors.text}],
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>
          </View>

          {/* Existing Categories */}
          <View style={[styles.listSection, {backgroundColor: colors.surface}]}>
            <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>
              Your Categories ({categories.length})
            </Text>
            {categories.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="tag" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyText, {color: colors.text}]}>No categories yet</Text>
                <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>Add your first category above</Text>
              </View>
            ) : (
              <FlatList
                data={categories}
                renderItem={renderCategory}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              />
            )}
          </View>

          {/* Done Button */}
          <TouchableOpacity style={[styles.doneBtn, {backgroundColor: colors.accent}]} onPress={onClose}>
            <Text style={[styles.doneBtnText, {color: colors.textLight}]}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {

    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },

  // Add Section
  addSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  colorPreview: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,

    borderWidth: 1,

  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
  },

  // Color Picker
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
  },

  // List Section
  listSection: {
    flex: 1,
    padding: theme.spacing.md,
    minHeight: 150,
  },
  list: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: theme.spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: theme.fontSize.md,

  },
  removeBtn: {
    padding: theme.spacing.xs,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginTop: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },

  // Done Button
  doneBtn: {
    margin: theme.spacing.md,
    paddingVertical: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },

  // Category Item Enhancements
  categoryMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryNameContainer: {
    flex: 1,
  },
  categoryCount: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },

  // Item Selection Modal
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  categoryColorSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  selectHint: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,

  },
  itemsList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  selectableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    borderWidth: 1,

  },
  selectableItemActive: {
  },
  selectableItemContent: {
    flex: 1,
  },
  selectableItemName: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
  selectableItemCategory: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
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

  // Batch Tag Button
  batchTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

  },
  batchTagBtnContent: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  batchTagBtnTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  batchTagBtnSubtitle: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,

    paddingVertical: 4,
  },

  // Selection Actions
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,

  },
  selectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  selectActionText: {
    fontSize: theme.fontSize.sm,

  },

  // Current Category Badge
  currentCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  categoryDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Apply Section
  applySection: {
    padding: theme.spacing.md,
    borderTopWidth: 1,

  },
  applySectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.sm,
  },
  categoryChipsScroll: {
    maxHeight: 50,
  },
  categoryChipsContainer: {
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.full,
    borderWidth: 1,

    gap: 6,
  },
  removeCategoryChip: {
  },
  categoryChipText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
});

export default CategoryManagerModal;
