import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { LineItemGalleryPicker } from './LineItemGalleryPicker';
import type { EstimateMedia } from '../../types/estimate';

export interface LineItemData {
  id: string;
  description: string;
  quantity: number;
  cost: number;
  sellPrice?: number;
  type?: 'material' | 'labor';
  labor?: number;
  laborRate?: number;
  category?: string;
  mediaIds?: string[];
  inventoryId?: string; // Reference to the inventory item for deduction on job completion
}

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

export interface LineItemRowProps {
  item: LineItemData;
  index: number;
  onUpdate: (id: string, updates: Partial<LineItemData>) => void;
  onRemove: (id: string) => void;
  categories?: CategoryOption[];
  showCategory?: boolean;
  showMediaCount?: boolean;
  onMediaPress?: (itemId: string) => void;
  compact?: boolean;
  /** Gallery media available for linking to this line item */
  galleryMedia?: EstimateMedia[];
}

export const LineItemRow: React.FC<LineItemRowProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  categories = [],
  showCategory = true,
  showMediaCount: _showMediaCount = false,
  onMediaPress: _onMediaPress,
  compact: _compact = true,
  galleryMedia = [],
}) => {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [costDisplayValue, setCostDisplayValue] = useState(item.cost ? String(item.cost) : '0');
  const [sellDisplayValue, setSellDisplayValue] = useState(item.sellPrice !== undefined ? String(item.sellPrice) : '0');
  const [qtyDisplayValue, setQtyDisplayValue] = useState(String(item.quantity));
  const [laborDisplayValue, setLaborDisplayValue] = useState(item.labor ? String(item.labor) : '0');
  const [laborRateDisplayValue, setLaborRateDisplayValue] = useState(item.laborRate ? String(item.laborRate) : '0');
  const [costFocused, setCostFocused] = useState(false);
  const [sellFocused, setSellFocused] = useState(false);
  const [qtyFocused, setQtyFocused] = useState(false);
  const [laborFocused, setLaborFocused] = useState(false);
  const [laborRateFocused, setLaborRateFocused] = useState(false);

  // Sync display values with item props when not focused
  useEffect(() => {
    if (!costFocused) setCostDisplayValue(item.cost ? String(item.cost) : '0');
  }, [item.cost, costFocused]);

  useEffect(() => {
    if (!sellFocused) setSellDisplayValue(item.sellPrice !== undefined ? String(item.sellPrice) : '0');
  }, [item.sellPrice, sellFocused]);

  useEffect(() => {
    if (!qtyFocused) setQtyDisplayValue(String(item.quantity || 1));
  }, [item.quantity, qtyFocused]);

  useEffect(() => {
    if (!laborFocused) setLaborDisplayValue(item.labor ? String(item.labor) : '0');
  }, [item.labor, laborFocused]);

  useEffect(() => {
    if (!laborRateFocused) setLaborRateDisplayValue(item.laborRate ? String(item.laborRate) : '0');
  }, [item.laborRate, laborRateFocused]);
  
  const isLabor = item.type === 'labor';
  const sellPrice = item.sellPrice || 0;
  const lineTotal = isLabor
    ? (item.labor || 0) * (item.laborRate || 0)
    : sellPrice * item.quantity;
  const hasProfit = !isLabor && item.sellPrice !== undefined && item.cost > 0 && item.sellPrice !== item.cost;
  // const mediaCount = item.mediaIds?.length || 0;
  const selectedMediaIds = item.mediaIds || [];

  const handleMediaSelectionChange = (mediaIds: string[]) => {
    onUpdate(item.id, { mediaIds });
  };

  const rowZIndex = 1000 - index;
  const { colors } = useTheme();

  if (isLabor) {
    return (
      <View style={[styles.rowWrapper, { zIndex: rowZIndex, elevation: rowZIndex, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.mainRow}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onRemove(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="x" size={14} color={colors.error} />
          </TouchableOpacity>
        
          <View style={[styles.laborBadge, {backgroundColor: `${colors.warning}20`, borderColor: colors.warning}]}>
            <Text style={[styles.laborBadgeText, {color: colors.warning}]}>L</Text>
          </View>
         
         
          <TextInput
            style={[styles.nameInput, {backgroundColor: colors.background, borderColor: colors.border, color: colors.text}]}
            value={item.description}
            onChangeText={text => onUpdate(item.id, { description: text })}
            placeholder="Labor description"
            placeholderTextColor={colors.textSecondary}
          />
          

          <View style={styles.fieldCell}>
            <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>Hrs</Text>
            <TextInput
              style={[styles.fieldInput, {backgroundColor: colors.background, borderColor: colors.border, color: colors.text}]}
              value={laborDisplayValue}
              onFocus={() => {
                setLaborFocused(true);
                if (laborDisplayValue === '0') setLaborDisplayValue('');
              }}
              onChangeText={text => {
                setLaborDisplayValue(text);
                onUpdate(item.id, { labor: parseFloat(text) || 0 });
              }}
              onBlur={() => {
                setLaborFocused(false);
                if (!laborDisplayValue) setLaborDisplayValue('0');
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.fieldCell}>
            <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>$/hr</Text>
            <TextInput
              style={[styles.fieldInput, {backgroundColor: colors.background, borderColor: colors.border, color: colors.text}]}
              value={laborRateDisplayValue}
              onFocus={() => {
                setLaborRateFocused(true);
                if (laborRateDisplayValue === '0') setLaborRateDisplayValue('');
              }}
              onChangeText={text => {
                const sanitized = text.replace(/[^0-9.]/g, '');
                setLaborRateDisplayValue(sanitized);
                onUpdate(item.id, { laborRate: parseFloat(sanitized) || 0 });
              }}
              onBlur={() => {
                setLaborRateFocused(false);
                if (!laborRateDisplayValue) setLaborRateDisplayValue('0');
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.totalCell}>
            <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>Total</Text>
            <Text style={[styles.totalText, {color: colors.text}]}>${lineTotal.toFixed(0)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.rowWrapper, { zIndex: rowZIndex, elevation: rowZIndex, backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Single horizontal row with all fields */}
      <View style={styles.mainRow}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onRemove(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="x" size={14} color={colors.error} />
        </TouchableOpacity>

      <View style={styles.nameCell}>
         <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>

        <TextInput
          style={[styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          value={item.description}
          onChangeText={text => onUpdate(item.id, { description: text })}
          placeholder="Item name"
          placeholderTextColor={colors.textSecondary}
        />
</View>
        <View style={styles.fieldCell}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>QTY</Text>
          <TextInput
            style={[styles.fieldInputSmall, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={qtyDisplayValue}
            onFocus={() => {
              setQtyFocused(true);
              if (qtyDisplayValue === '0') setQtyDisplayValue('');
            }}
            onChangeText={text => {
              setQtyDisplayValue(text);
              onUpdate(item.id, { quantity: parseInt(text, 10) || 0 });
            }}
            onBlur={() => {
              setQtyFocused(false);
              if (!qtyDisplayValue) setQtyDisplayValue('1');
            }}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.fieldCell}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>COST</Text>
          <TextInput
            style={[styles.fieldInputSmall, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={costDisplayValue}
            selectTextOnFocus={true}
            onFocus={() => {
              setCostFocused(true);
              if (costDisplayValue === '0') setCostDisplayValue('');
            }}
            onChangeText={text => {
              const sanitized = text.replace(/[^0-9.]/g, '');
              setCostDisplayValue(sanitized);
              onUpdate(item.id, { cost: parseFloat(sanitized) || 0 });
            }}
            onBlur={() => {
              setCostFocused(false);
              if (!costDisplayValue) setCostDisplayValue('0');
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.fieldCell}>
          <Text style={[styles.fieldLabel, {color: colors.textSecondary}, hasProfit && {color: colors.success}]}>SELL</Text>
          <TextInput
            style={[styles.fieldInputSmall, {backgroundColor: colors.background, borderColor: colors.border, color: colors.text}, hasProfit && {borderColor: colors.success, backgroundColor: `${colors.success}08`}]}
            value={sellDisplayValue}
            selectTextOnFocus={true}
            onFocus={() => {
              setSellFocused(true);
              if (sellDisplayValue === '0') setSellDisplayValue('');
            }}
            onChangeText={text => {
              const sanitized = text.replace(/[^0-9.]/g, '');
              setSellDisplayValue(sanitized);
              onUpdate(item.id, { sellPrice: parseFloat(sanitized) || 0 });
            }}
            onBlur={() => {
              setSellFocused(false);
              if (!sellDisplayValue) setSellDisplayValue('0');
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.totalCell}>
          <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>TOTAL</Text>
          <Text style={[styles.totalText, {color: colors.text}, hasProfit && {color: colors.success}]}>
            ${lineTotal.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Category row - only if showCategory and categories exist */}
      {showCategory && categories.length > 0 && (
        <View style={[styles.categoryRow, {borderTopColor: colors.divider}]}>
          <TouchableOpacity
            style={styles.categoryBtn}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            {item.category ? (
              <View style={[styles.categoryBadge, {backgroundColor: `${colors.accent}10`, borderColor: colors.accent}]}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: categories.find(c => c.name === item.category)?.color || colors.accent },
                  ]}
                />
                <Text style={[styles.categoryText, {color: colors.accent}]}>{item.category}</Text>
              </View>
            ) : (
              <Text style={[styles.addCategoryText, {color: colors.textSecondary}]}>+ Category</Text>
            )}
          </TouchableOpacity>

          {showCategoryPicker && (
            <View style={[styles.categoryDropdown, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryOption,
                    item.category === cat.name && {backgroundColor: `${colors.accent}10`},
                  ]}
                  onPress={() => {
                    onUpdate(item.id, { category: cat.name });
                    setShowCategoryPicker(false);
                  }}
                >
                  <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  <Text
                    style={[
                      styles.categoryOptionText,
                      {color: colors.text},
                      item.category === cat.name && {color: colors.accent, fontWeight: '500'},
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {item.category && (
                <TouchableOpacity                   style={[styles.categoryOption, {backgroundColor: colors.surface}]}
                  onPress={() => {
                    onUpdate(item.id, { category: undefined });
                    setShowCategoryPicker(false);
                  }}
                >
                  <Icon name="x" size={12} color={colors.textSecondary} />
                  <Text style={[styles.categoryOptionText, {color: colors.text}]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Gallery Photo Picker - bidirectional linking */}
      {galleryMedia.length > 0 && (
        <View style={[styles.lineItemMediaContainer, {backgroundColor: colors.surface}, {borderTopColor: colors.divider}]}>
          <LineItemGalleryPicker
            galleryMedia={galleryMedia}
            selectedMediaIds={selectedMediaIds}
            onSelectionChange={handleMediaSelectionChange}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  rowWrapper: {

    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderWidth: 1,

  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laborBadge: {

    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,

  },
  laborBadgeText: {
    fontSize: 10,
    fontWeight: 'bold' as const,

  },
  nameInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    paddingVertical: 4,
    paddingHorizontal: 6,

    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,

    minWidth: 80,

  },
  fieldCell: {
    alignItems: 'center',
    width: 50,
  },
  nameCell: {
    flex: 1,
    alignItems: 'center',
    width: 50,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: theme.fontWeight.medium,

    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldLabelHighlight: {
  },
  fieldInput: {
    width: '100%',

    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    borderWidth: 1,

  },
  fieldInputSmall: {
    width: '100%',

    borderRadius: theme.borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    borderWidth: 1,

  },
  fieldInputHighlight: {
  },
  totalCell: {
    alignItems: 'center',
    width: 55,
  },
  totalText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,

  },
  totalTextHighlight: {
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,

    borderRadius: theme.borderRadius.full,
  },
  mediaBtnText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,

  },
  categoryRow: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,

  },
  categoryBtn: {
    alignSelf: 'flex-start',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,

    borderRadius: theme.borderRadius.full,
    borderWidth: 1,

  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: theme.fontSize.xs,

    fontWeight: theme.fontWeight.medium,
  },
  addCategoryText: {
    fontSize: theme.fontSize.xs,

  },
  categoryDropdown: {
    marginTop: theme.spacing.xs,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    padding: 4,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
  },
  categoryOptionActive: {
  },
  categoryOptionText: {
    fontSize: theme.fontSize.sm,

  },
  categoryOptionTextActive: {

    fontWeight: theme.fontWeight.medium,
  },
  lineItemMediaContainer: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,

    zIndex: 200,
  },
});

export default LineItemRow;
