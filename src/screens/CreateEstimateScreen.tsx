import React, {useCallback, useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useClient} from '../context/ClientContext';
import {useEstimate} from '../context/EstimateContext';
// import {useJob} from '../context/JobContext';
import {useInventory} from '../context/InventoryContext';
import {Button} from '../components/Button';
import {ScreenHeader, AnimatedPressable, ConfirmationModal, CalendarPicker, LineItemRow, InventoryItemPicker} from '../components/ui';
import type {LineItemData} from '../components/ui/LineItemRow';
import {EstimateGallery} from '../components/EstimateGallery';
import type {CreateEstimateScreenProps} from '../types/navigation';
import type {EstimateLineItem} from '../types/estimate';
import {haptics} from '../utils/haptics';

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const CreateEstimateScreen: React.FC<CreateEstimateScreenProps> = ({navigation}) => {
  const {clients, loadClients} = useClient();
  const {
    draftEstimate,
    updateDraft,
    addLineItem,
    updateLineItem,
    removeLineItem,
    clearDraft,
    saveDraft,
    draftTotalCost,
    draftTotalSellPrice,
    draftTotalLabor,
    draftTotalLaborCost,
    loading,
    initDraft,
    addMedia,
  } = useEstimate();

  const { items: inventoryItems, customCategories } = useInventory();

  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lineItemsExpanded, setLineItemsExpanded] = useState(true);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showProposedDatePicker, setShowProposedDatePicker] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  
  // FAB Animation
  const fabRotation = useRef(new Animated.Value(1)).current; 
  const fabMenuScale = useRef(new Animated.Value(1)).current;
  const fabMenuOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!draftEstimate) {
      initDraft();
    }
  }, [draftEstimate, initDraft]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fabRotation, {
        toValue: showFabMenu ? 1 : 0,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.spring(fabMenuScale, {
        toValue: showFabMenu ? 1 : 0,
        useNativeDriver: true,
        tension: 300,
        friction: 12,
      }),
      Animated.timing(fabMenuOpacity, {
        toValue: showFabMenu ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showFabMenu, fabRotation, fabMenuScale, fabMenuOpacity]);

  const handleAddLineItem = useCallback(() => {
    const newItem: EstimateLineItem = {
      id: generateId(),
      title: '',
      description: '',
      quantity: 1,
      price: 0,
      cost: 0,
      labor: 0,
      isManual: true,
      type: 'material',
    };
    addLineItem(newItem);
  }, [addLineItem]);

  const handleAddLaborItem = useCallback(() => {
    const newItem: EstimateLineItem = {
      id: generateId(),
      title: 'Labor',
      description: '',
      quantity: 1,
      price: 50,
      cost: 0,
      labor: 1,
      laborRate: 50,
      isManual: true,
      type: 'labor',
    };
    addLineItem(newItem);
  }, [addLineItem]);

  const handleAddFromInventory = useCallback(() => {
    setShowInventoryPicker(true);
  }, []);

  const handleInventoryPickerConfirm = useCallback((selected: Array<{item: {id: string; name: string; quantity: number; price: number; category?: string; imageS3Key?: string}; selectedQuantity: number}>) => {
    selected.forEach(sel => {
      const lineItemId = generateId();
      const mediaIds: string[] = [];

      // If inventory item has an image, add it to the estimate gallery
      if (sel.item.imageS3Key) {
        const mediaId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        mediaIds.push(mediaId);
        const s3BaseUrl = 'https://nmj-dev-gallery.s3.us-east-2.amazonaws.com';
        addMedia({
          id: mediaId,
          s3Key: sel.item.imageS3Key,
          uri: `${s3BaseUrl}/${sel.item.imageS3Key}`,
          thumbnailUri: `${s3BaseUrl}/${sel.item.imageS3Key}`,
          fileName: sel.item.imageS3Key.split('/').pop() || 'inventory-image.jpg',
          type: 'photo',
          mimeType: 'image/jpeg',
          sizeBytes: 0,
          isLocal: true,
        });
      }

      const newItem: EstimateLineItem = {
        id: lineItemId,
        title: sel.item.name,
        description: sel.item.name,
        quantity: sel.selectedQuantity,
        price: sel.item.price,
        cost: sel.item.price,
        labor: 0,
        sellPrice: 0,
        type: 'material',
        category: sel.item.category,
        isManual: false,
        inventoryId: sel.item.id,
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      };
      addLineItem(newItem);
    });
  }, [addLineItem, addMedia]);

  const handleAddFromTemplate = useCallback(() => {
    navigation.navigate('TemplatesList');
  }, [navigation]);

  const handleSelectClient = useCallback(() => {
    navigation.navigate('SelectClient');
  }, [navigation]);

  const handleSelectLocation = useCallback(() => {
    if (draftEstimate?.clientId) {
      navigation.navigate('SelectLocation', {clientId: draftEstimate.clientId});
    }
  }, [navigation, draftEstimate?.clientId]);

  // Check for empty sell prices
  const hasEmptySellPrices = useCallback(() => {
    if (!draftEstimate?.lineItems) return false;
    return draftEstimate.lineItems.some(item => 
      item.type !== 'labor' && (!item.sellPrice || item.sellPrice === 0)
    );
  }, [draftEstimate?.lineItems]);

  // Actual save logic — navigate straight to detail after save
  const performSave = useCallback(async () => {
    if (!draftEstimate?.name.trim()) {
      updateDraft({name: `Estimate ${draftEstimate?.estimateNumber || ''}`});
    }
    setIsSaving(true);
    try {
      const savedEstimate = await saveDraft();
      haptics.success();
      // Replace current screen with estimate detail (pop animation — feels like going back)
      navigation.replace('EstimateDetail', { estimateId: savedEstimate.id });
    } catch (error) {
      console.error('Error saving estimate:', error);
    } finally {
      setIsSaving(false);
    }
  }, [draftEstimate, saveDraft, updateDraft, navigation]);

  // Handle save with empty sell price warning
  const handleSave = useCallback(() => {
    if (hasEmptySellPrices()) {
      Alert.alert(
        'Empty Sell Prices',
        'You have items with empty sell prices. This may result in negative profit. Do you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', style: 'destructive', onPress: performSave }
        ]
      );
      return;
    }
    performSave();
  }, [hasEmptySellPrices, performSave]);

  const handleBack = useCallback(async () => {
    // Auto-save draft if there's content
    if (draftEstimate && (draftEstimate.lineItems.length > 0 || draftEstimate.name)) {
      try {
        await saveDraft();
      } catch (error) {
        console.error('Error auto-saving draft:', error);
      }
    }
    navigation.goBack();
  }, [draftEstimate, saveDraft, navigation]);

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardModal(false);
    clearDraft();
    navigation.goBack();
  }, [clearDraft, navigation]);


  const getClientName = () => {
    if (draftEstimate?.client) {
      return draftEstimate.client.contactName;
    }
    if (draftEstimate?.clientId) {
      const client = clients.find(c => c.id === draftEstimate.clientId);
      return client?.contactName || 'Unknown';
    }
    return 'Select Client';
  };

  const getLocationDisplay = () => {
    if (draftEstimate?.location) {
      const loc = draftEstimate.location;
      const addr = loc.addressLine1 || loc.name || '';
      const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
      return addr ? `${addr}${cityState ? ` · ${cityState}` : ''}` : cityState || 'Unknown location';
    }
    return 'Select Location';
  };

  const { colors, isDark } = useTheme();

  if (!draftEstimate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title="New Estimate" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="New Estimate"
        subtitle={draftEstimate.estimateNumber}
        onBack={handleBack}
        rightAction={
          <Text style={styles.headerTotal}>
            ${(draftTotalSellPrice + draftTotalLaborCost).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">

          {/* ═══ DETAILS MEGA CARD ═══ */}
          <View style={[styles.megaCard, {backgroundColor: colors.surface}]}>

            {/* Section: Details */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="file-text" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Details</Text>
              </View>
              <TextInput
                style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={draftEstimate.name}
                onChangeText={text => updateDraft({name: text})}
                placeholder="Estimate name *"
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={[styles.textInput, styles.textArea, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: theme.spacing.sm}]}
                value={draftEstimate.description}
                onChangeText={text => updateDraft({description: text})}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Divider */}
            <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

            {/* Section: Client & Location */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="users" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Client & Location</Text>
              </View>
              <View style={{gap: theme.spacing.sm}}>
                <AnimatedPressable
                  style={[styles.selectorRow, {borderColor: draftEstimate.clientId ? colors.accent : colors.border, backgroundColor: draftEstimate.clientId ? `${colors.accent}06` : colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md}]}
                  onPress={handleSelectClient}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="user" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Client</Text>
                    <Text
                      style={[styles.selectorValue, {color: draftEstimate.clientId ? colors.text : colors.textSecondary}]}
                      numberOfLines={1}
                    >
                      {getClientName()}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                </AnimatedPressable>
                <AnimatedPressable
                  style={[
                    styles.selectorRow,
                    {borderColor: draftEstimate.locationId ? colors.accent : colors.border, backgroundColor: draftEstimate.locationId ? `${colors.accent}06` : colors.background, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md},
                    !draftEstimate.clientId && {opacity: 0.4},
                  ]}
                  onPress={handleSelectLocation}
                  disabled={!draftEstimate.clientId}
                >
                  <View style={[styles.selectorIcon, {backgroundColor: `${colors.accent}12`}]}>
                    <Icon name="map-pin" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.selectorContent}>
                    <Text style={[styles.selectorLabel, {color: colors.textSecondary}]}>Location</Text>
                    <Text
                      style={[styles.selectorValue, {color: draftEstimate.locationId ? colors.text : colors.textSecondary}]}
                      numberOfLines={1}
                    >
                      {getLocationDisplay()}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSecondary} />
                </AnimatedPressable>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

            {/* Section: Schedule */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="calendar" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Schedule</Text>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Start Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateDisplay,
                      {borderColor: colors.border, backgroundColor: colors.surface},
                      !draftEstimate.proposedStartDate && styles.dateDisplayEmpty,
                    ]}
                    onPress={() => setShowProposedDatePicker(true)}
                  >
                    <View style={[
                      styles.dateIconContainer,
                      draftEstimate.proposedStartDate && styles.dateIconContainerFilled,
                    ]}>
                      <Icon
                        name="calendar"
                        size={14}
                        color={draftEstimate.proposedStartDate ? '#FFFFFF' : colors.accent}
                      />
                    </View>
                    <Text style={[styles.dateText, {color: colors.text}, draftEstimate.proposedStartDate && styles.dateTextFilled]}>
                      {draftEstimate.proposedStartDate
                        ? new Date(draftEstimate.proposedStartDate).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true
                          })
                        : 'Tap to set date & time'
                      }
                    </Text>
                    {!draftEstimate.proposedStartDate && (
                      <Icon name="plus" size={14} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.dateField}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Expires</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateDisplay,
                      {borderColor: colors.border, backgroundColor: colors.surface},
                      !draftEstimate.expirationDate && styles.dateDisplayEmpty,
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <View style={[
                      styles.dateIconContainer,
                      draftEstimate.expirationDate && styles.dateIconContainerFilled,
                    ]}>
                      <Icon
                        name="calendar"
                        size={14}
                        color={draftEstimate.expirationDate ? '#FFFFFF' : colors.accent}
                      />
                    </View>
                    <Text style={[styles.dateText, {color: colors.text}, draftEstimate.expirationDate && styles.dateTextFilled]}>
                      {draftEstimate.expirationDate
                        ? new Date(draftEstimate.expirationDate).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true
                          })
                        : 'Tap to set date & time'
                      }
                    </Text>
                    {!draftEstimate.expirationDate && (
                      <Icon name="plus" size={14} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <CalendarPicker
                visible={showProposedDatePicker}
                onClose={() => setShowProposedDatePicker(false)}
                onSelectDate={(date) => {
                  updateDraft({proposedStartDate: date.toISOString()});
                }}
                onClear={() => updateDraft({proposedStartDate: undefined})}
                selectedDate={draftEstimate.proposedStartDate
                  ? new Date(draftEstimate.proposedStartDate)
                  : undefined}
                minimumDate={new Date()}
                title="Start Date & Time"
                showTime={true}
              />
              <CalendarPicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelectDate={(date) => {
                  updateDraft({expirationDate: date.toISOString()});
                }}
                onClear={() => updateDraft({expirationDate: undefined})}
                selectedDate={draftEstimate.expirationDate
                  ? new Date(draftEstimate.expirationDate)
                  : undefined}
                minimumDate={new Date()}
                title="Expiration Date & Time"
                showTime={true}
              />
            </View>
          </View>

          {/* Items - matching Job Materials hierarchy */}
          <View style={[styles.section, { zIndex: 10 }]}> 
            <TouchableOpacity 
              style={styles.collapsibleHeader} 
              onPress={() => setLineItemsExpanded(!lineItemsExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Items</Text>
                <Text style={[styles.itemCount, {backgroundColor: `${colors.accent}20`, color: colors.accent}]}>
                  {draftEstimate.lineItems.length} items
                </Text>
              </View>
              <Icon 
                name={lineItemsExpanded ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            {lineItemsExpanded && (
              <>
                {draftEstimate.lineItems.length > 0 ? (
                  <>
                    {draftEstimate.lineItems.map((item, index) => (
                      <LineItemRow
                        key={item.id}
                        item={item as LineItemData}
                        index={index}
                        onUpdate={updateLineItem}
                        onRemove={removeLineItem}
                        categories={customCategories}
                        showCategory={false}
                        showMediaCount={true}
                        galleryMedia={draftEstimate.media || []}
                      />
                    ))}
                    {/* Inline Add Buttons */}
                    <View style={styles.inlineAddButtons}>
                      <TouchableOpacity 
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddFromTemplate}
                      >
                        <Icon name="file-text" size={20} color={colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddFromInventory}
                      >
                        <Icon name="package" size={20} color={colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddLaborItem}
                      >
                        <Icon name="clock" size={20} color={colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.inlineAddBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
                        onPress={handleAddLineItem}
                      >
                        <Icon name="plus" size={20} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={[styles.emptyLineItems, {backgroundColor: colors.surface}]}>
                    <TouchableOpacity 
                      style={styles.addLineItemButton} 
                      onPress={() => setShowFabMenu(true)}
                    >
                      <Icon name="package" size={24} color={colors.textSecondary} />
                      <Text style={[styles.emptyLineItemsText, {color: colors.textSecondary}]}>
                        Tap here to add items
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
             <View style={styles.section}>
            <EstimateGallery 
              estimateId={draftEstimate.id || 'draft'} 
              readOnly={false}
            />
          </View>

          {/* Totals */}
          <View style={styles.section}>
            <View style={[styles.totalsCard, {backgroundColor: colors.surface}]}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Materials Cost</Text>
                <Text style={[styles.totalCostValue, {color: colors.text}]}>
                  ${draftTotalCost.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Materials Sell Price</Text>
                <Text style={[styles.totalValue, {color: colors.text}]}>
                  ${draftTotalSellPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              {draftTotalSellPrice !== draftTotalCost && (
                <View style={styles.totalRow}>
                  <Text style={[
                    styles.profitLabel, 
                    {color: draftTotalSellPrice >= draftTotalCost ? colors.success : colors.error}
                  ]}>Profit</Text>
                  <Text style={[
                    styles.profitValue,
                    {color: draftTotalSellPrice >= draftTotalCost ? colors.success : colors.error}
                  ]}>
                    {draftTotalSellPrice >= draftTotalCost ? '+' : '-'}${Math.abs(draftTotalSellPrice - draftTotalCost).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              )}
              <View style={[styles.divider, {backgroundColor: colors.divider}]} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, {color: colors.textSecondary}]}>Labor ({draftTotalLabor} hrs)</Text>
                <Text style={[styles.totalValue, {color: colors.text}]}>
                  ${draftTotalLaborCost.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View style={[styles.divider, {backgroundColor: colors.divider}]} />
              <View style={styles.totalRow}>
                <Text style={[styles.grandTotalLabel, {color: colors.text}]}>Estimate Total</Text>
                <Text style={[styles.grandTotalValue, {color: colors.accent}]}>
                  ${(draftTotalSellPrice + draftTotalLaborCost).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.saveButtonContainer}>
            <Button
              title={isSaving ? 'Saving...' : 'Save Estimate'}
              onPress={handleSave}
              loading={isSaving || loading}
              disabled={!draftEstimate?.name?.trim()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ConfirmationModal
        visible={showDiscardModal}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        icon="alert-triangle"
        iconColor={colors.warning}
        buttons={[
          {text: 'Cancel', onPress: () => setShowDiscardModal(false), style: 'cancel'},
          {text: 'Discard', onPress: handleConfirmDiscard},
        ]}
      />
      <Modal
        visible={showFabMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFabMenu(false)}
      >
        <TouchableOpacity 
          style={styles.addItemModalOverlay}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        >
          <View style={[styles.addItemModalContent, {backgroundColor: colors.surface}]}>
            <Text style={[styles.addItemModalTitle, {color: colors.text}]}>Add Item</Text>
            <TouchableOpacity style={[styles.addItemOption, {borderBottomColor: colors.border}]} onPress={() => {setShowFabMenu(false); handleAddLineItem();}}>
              <View style={[styles.addItemIconWrap, {backgroundColor: `${colors.accent}15`}]}><Icon name="plus" size={20} color={colors.accent} /></View>
              <Text style={[styles.addItemOptionText, {color: colors.text}]}>Add Material</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addItemOption, {borderBottomColor: colors.border}]} onPress={() => {setShowFabMenu(false); handleAddLaborItem();}}>
              <View style={[styles.addItemIconWrap, {backgroundColor: `${colors.warning}15`}]}><Icon name="clock" size={20} color={colors.warning} /></View>
              <Text style={[styles.addItemOptionText, {color: colors.warning}]}>Add Labor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addItemOption, {borderBottomColor: colors.border}]} onPress={() => {setShowFabMenu(false); handleAddFromInventory();}}>
              <View style={[styles.addItemIconWrap, {backgroundColor: `${colors.accent}15`}]}><Icon name="package" size={20} color={colors.accent} /></View>
              <Text style={[styles.addItemOptionText, {color: colors.text}]}>From Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addItemOption, {borderBottomColor: colors.border}]} onPress={() => {setShowFabMenu(false); handleAddFromTemplate();}}>
              <View style={[styles.addItemIconWrap, {backgroundColor: `${colors.accent}15`}]}><Icon name="file-text" size={20} color={colors.accent} /></View>
              <Text style={[styles.addItemOptionText, {color: colors.text}]}>From Template</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addItemCancelBtn} onPress={() => setShowFabMenu(false)}>
              <Text style={[styles.addItemCancelText, {color: colors.textSecondary}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Inventory Picker Modal */}
      <InventoryItemPicker
        visible={showInventoryPicker}
        onClose={() => setShowInventoryPicker(false)}
        items={inventoryItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          category: item.category,
          imageS3Key: item.imageS3Key,
        }))}
        selectedItems={[]}
        onConfirm={handleInventoryPickerConfirm}
        title="Add Items from Inventory"
        categories={customCategories}
        compact
      />
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
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 140,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: theme.fontSize.md,

  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    flex: 1,
  },
  headerTotalSign: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    marginRight: 2,
  },
  headerTotalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
  },

  // ═══ MEGA CARD ═══
  megaCard: {

    borderRadius: theme.borderRadius.xl,
    ...theme.shadow.sm,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  megaSection: {
    padding: theme.spacing.md,
  },
  megaDivider: {
    height: 1,

    marginHorizontal: theme.spacing.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
  },
  itemCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  textInput: {

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,

    borderWidth: 1,

  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    fontSize: theme.fontSize.xs,

    marginBottom: 4,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    minHeight: 52,
  },
  dateDisplayEmpty: {
    backgroundColor: `${theme.colors.accent}08`,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
  },
  dateIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${theme.colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateIconContainerFilled: {
    backgroundColor: theme.colors.accent,
  },
  dateText: {
    flex: 1,
    fontSize: theme.fontSize.sm,

  },
  dateTextFilled: {
    fontWeight: theme.fontWeight.medium,
  },

  // ═══ ITEMS SECTION ═══
  itemsSection: {
    marginBottom: theme.spacing.lg,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  itemsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  itemsTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  selectorContent: {
    flex: 1,
  },
  selectorLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  selectorPlaceholder: {
    color: theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.sm,
  },

  inlineAddButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  inlineAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,

    ...theme.shadow.sm,
  },
  addPillText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },

  // Empty items state
  emptyItems: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,

    borderStyle: 'dashed',
  },
  emptyItemsIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyItemsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: 4,
  },
  emptyItemsSub: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyItemsActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  emptyActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  emptyActionPrimaryText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: '#FFFFFF',
  },
  emptyActionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
  },
  emptyActionOutlineText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  emptyItemsSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  emptySecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptySecText: {
    fontSize: theme.fontSize.xs,

  },
  emptySecDot: {
    fontSize: theme.fontSize.md,
  },

  // ═══ TOTALS ═══
  totalsCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,

  },
  totalCostValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  totalValueMuted: {
    fontSize: theme.fontSize.sm,

  },
  totalValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
  },
  laborLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  profitValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  lossLabel: {
  },
  lossValue: {
  },
  saveButtonContainer: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  grandTotalLabel: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  grandTotalValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  headerTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  emptyLineItems: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  emptyLineItemsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  addLineItemButton:{
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  addItemModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '85%',
    maxWidth: 320,
  },
  addItemModalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  totalsDivider: {
    height: 1,

    marginVertical: theme.spacing.xs,
  },

  // ═══ STICKY BOTTOM BAR ═══
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,

    ...theme.shadow.lg,
  },
  stickyBarLeft: {
    flex: 1,
  },
  stickyBarLabel: {
    fontSize: theme.fontSize.xs,

  },
  stickyBarValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  saveBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#FFFFFF',
  },

  // ═══ BOTTOM SHEET (Add Item) ═══
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 34,
    ...theme.shadow.lg,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,

    alignSelf: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  bottomSheetTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  addItemOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  addItemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.colors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  addItemOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  bottomSheetOptionDesc: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  bottomSheetCancel: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  addItemCancelBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  addItemCancelText: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
});