import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar, FlatList,
  TouchableOpacity, Modal, TextInput, ScrollView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ScreenHeader, AnimatedPressable } from '../components/ui';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { warehouseService } from '../services/api/domain/warehouse/warehouseService';
import type { WarehouseRM, WarehouseListItem } from '../types/apiResponses';
import type { WarehousesScreenProps } from '../types/navigation';
import type { GeocodingResult } from '../services/geocodingService';

interface FormData {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

const emptyForm: FormData = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipcode: '',
  country: 'USA',
};

export const WarehousesScreen: React.FC<WarehousesScreenProps> = ({ navigation }) => {
  const [warehouses, setWarehouses] = useState<WarehouseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WarehouseRM | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fullAddress, setFullAddress] = useState('');

  // Animation for modal
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (showModal) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [showModal, slideAnim]);

  const load = useCallback(async () => {
    try {
      const res = await warehouseService.getWarehouseList({ pageSize: 100 });
      setWarehouses(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = async (w: WarehouseListItem) => {
    try {
      const full = await warehouseService.getWarehouseById(w.id);
      setEditing(full);
      const formData = {
        name: full.name || '',
        addressLine1: full.addressLine1 || '',
        addressLine2: full.addressLine2 || '',
        city: full.city || '',
        state: full.state || '',
        zipcode: full.zipcode || '',
        country: full.country || 'USA',
        latitude: full.latitude,
        longitude: full.longitude,
      };
      setForm(formData);
      if (formData.addressLine1 && formData.city) {
        setFullAddress(`${formData.addressLine1}, ${formData.city}, ${formData.state}`);
      }
      setShowModal(true);
    } catch {
      Alert.alert('Error', 'Failed to load warehouse details');
    }
  };

  const handleDelete = (w: WarehouseListItem) => {
    const itemCount = w.totalInventoryItems || w.inventoryCount || 0;
    if (itemCount > 0) {
      Alert.alert(
        'Cannot Delete',
        `This warehouse has ${itemCount} inventory items. Remove or transfer all items before deleting.`
      );
      return;
    }
    Alert.alert(
      'Delete Warehouse',
      `Are you sure you want to delete "${w.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await warehouseService.deleteWarehouse(w.id);
              load();
            } catch {
              Alert.alert('Error', 'Failed to delete warehouse');
            }
          },
        },
      ]
    );
  };

  const handleAddressSelect = (address: GeocodingResult) => {
    setForm(f => ({
      ...f,
      addressLine1: address.addressLine1,
      addressLine2: '',
      city: address.city,
      state: address.state,
      zipcode: address.zipcode,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
    }));
    setFullAddress(address.formattedAddress);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Warehouse name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await warehouseService.updateWarehouse({ id: editing.id, ...form });
      } else {
        await warehouseService.createWarehouse(form);
      }
      setShowModal(false);
      setFullAddress('');
      load();
    } catch {
      Alert.alert('Error', 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: WarehouseListItem }) => {
    const itemCount = item.totalInventoryItems || item.inventoryCount || 0;
    const hasItems = itemCount > 0;

    return (
      <AnimatedPressable style={[styles.card, {backgroundColor: colors.surface}]} onPress={() => openEdit(item)}>
        <View style={[styles.iconContainer, {backgroundColor: `${colors.accent}15`}]}>
          <Icon name="package" size={24} color={colors.accent} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, {color: colors.text}]}>{item.name}</Text>
          <Text style={[styles.location, {color: colors.textSecondary}]}>
            {item.city ? `${item.city}, ${item.state}` : item.location || 'No address'}
          </Text>
          <Text style={[styles.itemCount, {color: colors.textSecondary}]}>{itemCount} items</Text>
        </View>
        {!hasItems && (
          <TouchableOpacity
            style={[styles.deleteBtn, {backgroundColor: `${colors.error}15`}]}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="trash-2" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
        <Icon name="chevron-right" size={20} color={colors.textSecondary} />
      </AnimatedPressable>
    );
  };

  const { colors, isDark } = useTheme();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScreenHeader
        title="Warehouses"
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity style={[styles.addButton, {backgroundColor: colors.accent}]} onPress={openAdd}>
            <Icon name="plus" size={24} color={colors.textLight} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={warehouses}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
            <Icon name="package" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, {color: colors.text}]}>No Warehouses</Text>
            <Text style={[styles.emptySubtitle, {color: colors.text}]}>Add a warehouse to organize your inventory</Text>
            <TouchableOpacity style={[styles.emptyButton, {backgroundColor: colors.accent}]} onPress={openAdd}>
              <Icon name="plus" size={18} color={colors.textLight} />
              <Text style={[styles.emptyButtonText, {color: colors.textLight}]}>Add Warehouse</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity 
            style={styles.modalOverlayTouchable} 
            activeOpacity={1} 
            onPress={() => setShowModal(false)}
          />
          <Animated.View style={[styles.modalContainer, {backgroundColor: colors.background}, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="x" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, {color: colors.text}]}>
                {editing ? 'Edit Warehouse' : 'New Warehouse'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Modal Body */}
            <ScrollView style={[styles.modalBody, {backgroundColor: colors.surface}]} showsVerticalScrollIndicator={false}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.text}]}>Warehouse Name *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                  value={form.name}
                  onChangeText={t => setForm(f => ({ ...f, name: t }))}
                  placeholder="e.g. Main Warehouse"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Address Section */}
              <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Address (Optional)</Text>

              <AddressAutocomplete
                value={fullAddress}
                onChangeText={setFullAddress}
                onSelectAddress={handleAddressSelect}
                placeholder="Search for address"
                label="Address Search"
              />

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.text}]}>Street Address</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                  value={form.addressLine1}
                  onChangeText={t => setForm(f => ({ ...f, addressLine1: t }))}
                  placeholder="123 Main Street"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.text}]}>Apt, Suite, Unit</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                  value={form.addressLine2}
                  onChangeText={t => setForm(f => ({ ...f, addressLine2: t }))}
                  placeholder="Suite 100"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, {color: colors.text}]}>City</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                    value={form.city}
                    onChangeText={t => setForm(f => ({ ...f, city: t }))}
                    placeholder="City"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, {color: colors.text}]}>State</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                    value={form.state}
                    onChangeText={t => setForm(f => ({ ...f, state: t }))}
                    placeholder="State"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, {color: colors.text}]}>ZIP Code</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                    value={form.zipcode}
                    onChangeText={t => setForm(f => ({ ...f, zipcode: t }))}
                    placeholder="12345"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, {color: colors.text}]}>Country</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
                    value={form.country}
                    onChangeText={t => setForm(f => ({ ...f, country: t }))}
                    placeholder="USA"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

            </ScrollView>

            {/* Save Button */}
            <View style={[styles.modalFooter, {backgroundColor: colors.surface}, {borderTopColor: colors.border}]}>
              <TouchableOpacity                 style={[styles.saveButton, {backgroundColor: colors.accent}, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={[styles.saveButtonText, {color: colors.text}]}>
                    {editing ? 'Save Changes' : 'Create Warehouse'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: theme.spacing.md,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card styles
  card: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: 2,
  },
  location: {
    fontSize: theme.fontSize.sm,

  },
  itemCount: {
    fontSize: theme.fontSize.xs,

    marginTop: 4,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.xs,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl * 2,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  emptyButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {

    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  modalBody: {
    padding: theme.spacing.lg,
  },
  modalFooter: {
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? theme.spacing.xl : theme.spacing.md,
    borderTopWidth: 1,

  },

  // Form styles
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
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
    borderWidth: 1,

    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  saveButton: {

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },

  // Map Button
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  mapButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginLeft: theme.spacing.sm,
  },
});
