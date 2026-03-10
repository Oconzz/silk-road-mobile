import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Button } from '../components/Button';
import {
  ScreenHeader,
  ConfirmationModal,
  CategoryManagerModal,
} from '../components/ui';
import { ImagePickerButton } from '../components/ImagePickerButton';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../context/InventoryContext';
import type {
  ManualEntryScreenProps,
  InventoryItem,
} from '../types/navigation';
import Icon from 'react-native-vector-icons/Feather';
import { uploadFile, EntityType } from '../services/mediaUploadService';

// Generate a valid UUID v4 for upload entityId
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface FormData {
  name: string;
  description: string;
  quantity: string;
  price: string;
  barcode: string;
  store: string;
  category: string;
  imageUri: string;
  imageMimeType: string;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  description: '',
  quantity: '1',
  price: '',
  barcode: '',
  store: '',
  category: '',
  imageUri: '',
  imageMimeType: '',
};

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({
  navigation,
  route,
}) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const { customCategories, addCategory, removeCategory } = useInventory();

  // Modal states
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercentage, setUploadPercentage] = useState<number>(0);

  // Get existing items from ReviewItems (if adding more)
  const existingItems = useMemo(
    () => route.params?.existingItems || [],
    [route.params?.existingItems],
  );

  // Set barcode and product info from route params if provided (from barcode scan)
  useEffect(() => {
    const params = route.params;
    if (params) {
      setFormData(prev => ({
        ...prev,
        barcode: params.barcode || prev.barcode,
        name: params.productName || prev.name,
        description: params.productDescription || prev.description,
        category: params.productCategory || prev.category,
      }));
      
      if (params.productName) {
        console.log('[ManualEntry] Product info loaded from barcode:', params.productName);
      }
    }
  }, [route.params]);

  const updateField = useCallback(
    (field: keyof FormData) => (value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const isFormValid = useMemo(() => {
    const { name, quantity, price } = formData;
    const qty = parseInt(quantity, 10);
    const prc = parseFloat(price.replace(',', '.'));
    return name.trim().length >= 2 && qty > 0 && prc > 0;
  }, [formData]);

  const handleAddItem = useCallback(async () => {
    if (!isFormValid) {
      setErrorMessage('Please fill in name, quantity and price.');
      setErrorModalVisible(true);
      return;
    }

    // Upload image if present
    let imageS3Key: string | undefined;
    if (formData.imageUri) {
      setIsUploading(true);
      setUploadPercentage(0);
      try {
        // Create a valid UUID for the upload (backend requires GUID format)
        const uploadEntityId = generateUUID();
        const result = await uploadFile(
          formData.imageUri,
          'inventory' as EntityType,
          uploadEntityId,
          formData.imageMimeType || undefined,
          progress => {
            setUploadPercentage(progress.percentage);
          },
        );
        if (result.success && result.s3Key) {
          imageS3Key = result.s3Key;
        } else {
          console.warn('Image upload failed:', result.error);
        }
      } catch (error) {
        console.error('Image upload error:', error);
      } finally {
        setIsUploading(false);
        setUploadPercentage(0);
      }
    }

    const newItem: InventoryItem = {
      id: `manual-${Date.now()}-${items.length + 1}`,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      quantity: parseInt(formData.quantity, 10),
      price: parseFloat(formData.price.replace(',', '.')),
      barcode: formData.barcode.trim() || undefined,
      store: formData.store.trim() || undefined,
      category: formData.category || undefined,
      imageS3Key: imageS3Key,
      imageUri: formData.imageUri || undefined,
      purchaseDate: new Date().toISOString(),
    };

    setItems(prev => [...prev, newItem]);
    setFormData(INITIAL_FORM_DATA);
  }, [formData, isFormValid, items.length]);

  // Barcode scanning disabled
  const handleScanBarcode = useCallback(() => {
    // navigation.navigate('BarcodeScanner', { ... });
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const { addItems } = useInventory();
  const [isSaving, setIsSaving] = useState(false);
  const handleSaveToInventory = useCallback(async () => {
    if (items.length === 0) {
      setErrorMessage('Please add at least one material.');
      setErrorModalVisible(true);
      return;
    }

    setIsSaving(true);
    try {
      // Merge existing items with new items
      const mergedItems = [...existingItems, ...items];
      addItems(mergedItems);
      console.log(
        '[ManualEntry] Items saved directly to inventory:',
        mergedItems.length,
      );
      // Navigate directly to Inventory tab (no confirmation modal)
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'InventoryTab' } }],
      });
    } catch (error) {
      console.error('[ManualEntry] Error saving items:', error);
      setErrorMessage('Failed to save materials. Please try again.');
      setErrorModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  }, [items, existingItems, addItems, navigation]);

  const totalItems = items.length;
  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScreenHeader
        title="Manual Entry"
        subtitle="Add materials manually"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView           style={[styles.scrollView, {backgroundColor: colors.background}]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Section - Improved hierarchy */}
          <View style={styles.formSection}>
            {/* Header with photo */}
            <View style={[styles.formHeader, {backgroundColor: colors.surface}]}>
              <ImagePickerButton
                imageUri={formData.imageUri}
                onImageSelected={(uri, mimeType) => {
                  setFormData(prev => ({
                    ...prev,
                    imageUri: uri,
                    imageMimeType: mimeType || 'image/jpeg',
                  }));
                }}
                onImageRemoved={() => {
                  setFormData(prev => ({
                    ...prev,
                    imageUri: '',
                    imageMimeType: '',
                  }));
                }}
                isUploading={isUploading}
                label=""
                placeholder="Photo"
                size={80}
              />
              <View style={styles.formHeaderInfo}>
                <Text style={[styles.formHeaderTitle, {color: colors.text}]}>New Material</Text>
                <Text style={[styles.formHeaderSubtitle, {color: colors.textSecondary}]}>Fill in the details below</Text>
              </View>
            </View>

            {/* Primary Fields Card */}
            <View style={[styles.fieldCard, {backgroundColor: colors.surface}]}>
              <Text style={[styles.fieldCardTitle, {color: colors.text}]}>Required Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, {color: colors.textSecondary}]}>Product Name</Text>
                <TextInput
                  style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={formData.name}
                  onChangeText={updateField('name')}
                  placeholder="E.g.: Phillips Screw 6mm"
                  placeholderTextColor={colors.gray}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, {color: colors.textSecondary}]}>Quantity</Text>
                  <TextInput
                    style={[styles.inputCompact, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={formData.quantity}
                    onChangeText={updateField('quantity')}
                    placeholder="1"
                    placeholderTextColor={colors.gray}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={[styles.label, {color: colors.textSecondary}]}>Unit Price ($)</Text>
                  <TextInput
                    style={[styles.inputCompact, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={formData.price}
                    onChangeText={updateField('price')}
                    placeholder="0.00"
                    placeholderTextColor={colors.gray}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            {/* Secondary Fields Card */}
            <View style={[styles.fieldCard, {backgroundColor: colors.surface}]}>
              <Text style={[styles.fieldCardTitle, {color: colors.text}]}>Additional Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, {color: colors.textSecondary}]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={formData.description}
                  onChangeText={updateField('description')}
                  placeholder="Additional product details"
                  placeholderTextColor={colors.gray}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, {color: colors.textSecondary}]}>Store</Text>
                <TextInput
                  style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={formData.store}
                  onChangeText={updateField('store')}
                  placeholder="E.g.: Home Depot"
                  placeholderTextColor={colors.gray}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Category Selector - Custom Categories */}
            <View style={styles.inputGroup}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.label, {color: colors.textSecondary}]}>Category</Text>
                <TouchableOpacity                   style={[styles.manageCategoriesBtn, {backgroundColor: colors.surface}]}
                  onPress={() => setShowCategoryManager(true)}
                >
                  <Icon name="settings" size={14} color={colors.accent} />
                  <Text style={[styles.manageCategoriesText, {color: colors.accent}]}>Manage</Text>
                </TouchableOpacity>
              </View>
              {customCategories.length > 0 ? (
                <View style={styles.categoryChipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.categoryChip,
                      !formData.category && [styles.categoryChipActive, {backgroundColor: colors.accent}],
                    ]}
                    onPress={() =>
                      setFormData(prev => ({ ...prev, category: '' }))
                    }
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        {color: colors.text},
                        !formData.category && {color: colors.textLight},
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {customCategories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        formData.category === cat.name &&
                          [styles.categoryChipActive, {backgroundColor: colors.accent}],
                        { borderColor: cat.color },
                      ]}
                      onPress={() =>
                        setFormData(prev => ({ ...prev, category: cat.name }))
                      }
                    >
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: cat.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          {color: colors.text},
                          formData.category === cat.name && {color: colors.textLight},
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addCategoryPrompt}
                  onPress={() => setShowCategoryManager(true)}
                >
                  <Icon
                    name="plus-circle"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={[styles.addCategoryPromptText, {color: colors.accent}]}>
                    Add your first category
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Button
              title="Add Material"
              onPress={handleAddItem}
              disabled={!isFormValid}
              style={styles.addButton}
            />
          </View>

          {/* Items List Section */}
          {items.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={[styles.sectionTitle, {color: colors.text}]}>
                Added Materials ({totalItems})
              </Text>

              {items.map(item => (
                <View key={item.id} style={[styles.itemCard, {backgroundColor: colors.surface}]}>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, {color: colors.text}]}>{item.name}</Text>
                    <Text style={[styles.itemDetails, {color: colors.textSecondary}]}>
                      {item.quantity}x ${item.price.toFixed(2)}
                    </Text>
                    {item.barcode && (
                      <Text style={[styles.itemBarcode, {color: colors.textSecondary}]}>{item.barcode}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.removeButton, {backgroundColor: colors.error}]}
                    onPress={() => handleRemoveItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.removeButtonText, {color: colors.textLight}]}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={[styles.totalContainer, {borderTopColor: colors.divider}]}>
                <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Total:</Text>
                <Text style={[styles.totalValue, {color: colors.accent}]}>${totalValue.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action */}
        {items.length > 0 && (
          <View style={[styles.bottomAction, {borderTopColor: colors.border}]}>
            <Button
              title={`Save ${totalItems} ${
                totalItems === 1 ? 'Material' : 'Materials'
              } to Inventory`}
              onPress={handleSaveToInventory}
              loading={isSaving}
              variant="primary"
            />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <ConfirmationModal
        visible={errorModalVisible}
        title="Error"
        message={errorMessage}
        icon="alert-circle"
        iconColor={colors.error}
        buttons={[{ text: 'OK', onPress: () => setErrorModalVisible(false) }]}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal
        visible={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={customCategories}
        onAddCategory={addCategory}
        onRemoveCategory={removeCategory}
      />

      {/* Upload Progress Modal */}
      <Modal visible={isUploading} transparent animationType="fade">
        <View style={styles.uploadModalOverlay}>
          <View style={[styles.uploadModalContent, {backgroundColor: colors.surface}]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.uploadModalTitle, {color: colors.text}]}>Uploading Image...</Text>
            {uploadPercentage > 0 && (
              <>
                <View style={[styles.progressBarContainer, {backgroundColor: colors.background}]}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${uploadPercentage}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.uploadModalPercentage, {color: colors.accent}]}>
                  {uploadPercentage}%
                </Text>
              </>
            )}
            <Text style={[styles.uploadModalSubtext, {color: colors.textSecondary}]}>Please wait...</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  formSection: {
    marginBottom: theme.spacing.lg,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,

    borderRadius: theme.borderRadius.lg,
  },
  formHeaderInfo: {
    flex: 1,
  },
  formHeaderTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  formHeaderSubtitle: {
    fontSize: theme.fontSize.sm,

    marginTop: 2,
  },
  fieldCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  fieldCardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    marginBottom: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  input: {

    borderWidth: 1,

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  inputCompact: {

    borderWidth: 1,

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    textAlign: 'center',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  barcodeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  barcodeInput: {
    flex: 1,
  },
  scanButton: {

    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: {

    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  addButton: {
    marginTop: theme.spacing.sm,
  },
  itemsSection: {
    marginTop: theme.spacing.md,
  },
  itemCard: {
    flexDirection: 'row',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,

  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  itemDetails: {
    fontSize: theme.fontSize.sm,

    marginTop: 2,
  },
  itemBarcode: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,

    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  removeButtonText: {

    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,

    marginTop: theme.spacing.sm,
  },
  totalLabel: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

  },
  totalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  bottomAction: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,

  },

  // Category Styles
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
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
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
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
  // Upload Progress Modal styles
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  uploadModalTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  uploadModalPercentage: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    marginTop: theme.spacing.xs,
  },
  uploadModalSubtext: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,

    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
  },
  progressBar: {
    height: '100%',

    borderRadius: theme.borderRadius.full,
  },
});
