import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useClient} from '../context/ClientContext';
import {useEstimate} from '../context/EstimateContext';
import {Button} from '../components/Button';
import {ScreenHeader, ConfirmationModal} from '../components/ui';
import {AddressAutocomplete} from '../components/AddressAutocomplete';
import type {CreateClientScreenProps} from '../types/navigation';
import type {GeocodingResult} from '../services/geocodingService';

export const CreateClientScreen: React.FC<CreateClientScreenProps> = ({navigation}) => {
  const {createClient: createClientInBackend, createLocation, loadClientLocations, loading: clientLoading} = useClient();
  const {updateDraft, draftEstimate} = useEstimate();
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Form state
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Locations list state
  interface LocationData {
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
    latitude?: number;
    longitude?: number;
    isPrimary: boolean;
  }
  
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  
  // Current location being edited in modal
  const [currentLocation, setCurrentLocation] = useState<LocationData>({
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
    isPrimary: false,
  });
  const [fullAddress, setFullAddress] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Validation
  const isValid = contactName.trim() && email.trim() && phone.trim();

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isValid) {
      return;
    }

    try {
      const clientData: any = {
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        companyName: companyName.trim() || undefined,
      };

      // Create client first (without locations)
      const client = await createClientInBackend(clientData);
      
      console.log('[CreateClientScreen] Client created:', client.id);
      
      // Then create all locations for this client
      if (locations.length > 0) {
        console.log('[CreateClientScreen] Creating', locations.length, 'locations');
        
        for (const loc of locations) {
          try {
            await createLocation(client.id, {
              name: loc.name || loc.addressLine1,
              addressLine1: loc.addressLine1,
              addressLine2: loc.addressLine2,
              city: loc.city,
              state: loc.state,
              zipcode: loc.zipcode,
              country: loc.country,
              latitude: loc.latitude,
              longitude: loc.longitude,
              isPrimary: loc.isPrimary,
            });
            console.log('[CreateClientScreen] Location created:', loc.name);
          } catch (locError) {
            console.error('[CreateClientScreen] Error creating location:', locError);
            // Continue with other locations even if one fails
          }
        }
      }
      
      // Update draft with new client only if draft exists (coming from estimate flow)
      if (draftEstimate && client) {
        // Reload client locations to get IDs
        await loadClientLocations(client.id);
        
        updateDraft({
          clientId: client.id,
          // Location will be selected in SelectLocationScreen
        });
      }

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error creating client:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create client. Please try again.',
        [{text: 'OK'}]
      );
    }
  }, [
    isValid,
    contactName,
    email,
    phone,
    companyName,
    locations,
    createClientInBackend,
    createLocation,
    loadClientLocations,
    updateDraft,
    draftEstimate,
  ]);

  // Open add location modal
  const handleAddLocation = useCallback(() => {
    setEditingLocationIndex(null);
    setCurrentLocation({
      name: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'USA',
      isPrimary: locations.length === 0, // First location is primary by default
    });
    setFullAddress('');
    setShowLocationModal(true);
  }, [locations.length]);
  
  // Edit existing location
  const handleEditLocation = useCallback((index: number) => {
    setEditingLocationIndex(index);
    setCurrentLocation(locations[index]);
    setFullAddress(`${locations[index].addressLine1}, ${locations[index].city}`);
    setShowLocationModal(true);
  }, [locations]);
  
  // Delete location
  const handleDeleteLocation = useCallback((index: number) => {
    Alert.alert(
      'Delete Location',
      'Are you sure you want to remove this location?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const newLocations = locations.filter((_, i) => i !== index);
            // If deleted location was primary, make first one primary
            if (locations[index].isPrimary && newLocations.length > 0) {
              newLocations[0].isPrimary = true;
            }
            setLocations(newLocations);
          },
        },
      ]
    );
  }, [locations]);
  
  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback((address: GeocodingResult) => {
    console.log('[CreateClientScreen] Address selected:', address);
    setCurrentLocation(prev => ({
      ...prev,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      zipcode: address.zipcode,
      latitude: address.latitude,
      longitude: address.longitude,
      name: prev.name || address.formattedAddress,
    }));
    setFullAddress(address.formattedAddress);
  }, []);
  
  // Save current location to list
  const handleSaveLocation = useCallback(() => {
    if (!currentLocation.addressLine1 || !currentLocation.city) {
      Alert.alert('Error', 'Please provide at least an address and city');
      return;
    }
    
    const newLocation = {...currentLocation};
    
    if (editingLocationIndex !== null) {
      // Update existing location
      const updated = [...locations];
      updated[editingLocationIndex] = newLocation;
      setLocations(updated);
    } else {
      // Add new location
      // If this is marked as primary, unmark others
      if (newLocation.isPrimary) {
        setLocations(prev => [...prev.map(l => ({...l, isPrimary: false})), newLocation]);
      } else {
        setLocations(prev => [...prev, newLocation]);
      }
    }
    
    setShowLocationModal(false);
  }, [currentLocation, editingLocationIndex, locations]);

  // Success dismiss
  const handleSuccessDismiss = useCallback(() => {
    setShowSuccessModal(false);
    navigation.goBack();
  }, [navigation]);

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="New Client"
        onBack={() => navigation.goBack()}
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

            {/* Section: Contact Information */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="user" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Contact Information</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Contact Name *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder="John Smith"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Email *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="john@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Phone *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Company Name</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Optional"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

            {/* Section: Locations */}
            <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
              <View style={styles.sectionLabelRow}>
                <Icon name="map-pin" size={15} color={colors.accent} />
                <Text style={[styles.sectionLabel, {color: colors.text}]}>Locations</Text>
                <View style={{flex: 1}} />
                <TouchableOpacity
                  onPress={handleAddLocation}
                  style={[styles.addPill, {backgroundColor: `${colors.accent}12`}]}
                  activeOpacity={0.7}
                >
                  <Icon name="plus" size={14} color={colors.accent} />
                  <Text style={[styles.addPillText, {color: colors.accent}]}>Add</Text>
                </TouchableOpacity>
              </View>
            
            {locations.map((loc, index) => (
              <View key={index} style={[styles.locationCard, {backgroundColor: colors.surface}]}>
                <View style={styles.locationHeader}>
                  <View style={styles.locationInfo}>
                    <Icon name="map-pin" size={16} color={colors.accent} />
                    <Text style={[styles.locationName, {color: colors.text}]}>
                      {loc.name || loc.addressLine1}
                    </Text>
                    {loc.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.locationActions}>
                    <TouchableOpacity
                      onPress={() => handleEditLocation(index)}
                      style={styles.iconButton}
                    >
                      <Icon name="edit-2" size={16} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteLocation(index)}
                      style={styles.iconButton}
                    >
                      <Icon name="trash-2" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.locationAddress, {color: colors.textSecondary}]}>
                  {loc.addressLine1}
                  {loc.addressLine2 ? `, ${loc.addressLine2}` : ''}
                </Text>
                <Text style={[styles.locationCity, {color: colors.textSecondary}]}>
                  {loc.city}, {loc.state} {loc.zipcode}
                </Text>
              </View>
            ))}
            
            {locations.length === 0 && (
              <View style={[styles.emptyLocations, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Icon name="map" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No locations added yet</Text>
                <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>Tap "Add Location" to get started</Text>
              </View>
            )}
            </View>
          </View>

        </ScrollView>

        {/* Save Button */}
        <View style={[styles.bottomBar, {backgroundColor: colors.surface}]}>
          <Button
            title={clientLoading ? 'Saving...' : 'Save Client'}
            onPress={handleSave}
            loading={clientLoading}
            disabled={!isValid || clientLoading}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        title="Client Created!"
        message="The client has been added successfully and selected for your estimate."
        icon="check-circle"
        iconColor={colors.success}
        buttons={[
          {text: 'Continue', onPress: handleSuccessDismiss},
        ]}
      />

      {/* Location Modal */}
      <Modal
        visible={showLocationModal}
         animationType="fade"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, {backgroundColor: colors.background}]}>
          <View style={[styles.modalHeader, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}>
              <Icon name="x" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, {color: colors.text}]}>
              {editingLocationIndex !== null ? 'Edit Location' : 'Add Location'}
            </Text>
            <View style={{width: 24}} />
          </View>
          
          <ScrollView style={[styles.modalScrollContent, {backgroundColor: colors.surface}]} keyboardShouldPersistTaps="handled">
            {/* ═══ Location Modal Mega Card ═══ */}
            <View style={[styles.megaCard, {backgroundColor: colors.surface}]}>
              <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
                <View style={styles.sectionLabelRow}>
                  <Icon name="tag" size={15} color={colors.accent} />
                  <Text style={[styles.sectionLabel, {color: colors.text}]}>Details</Text>
                </View>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={currentLocation.name}
                  onChangeText={(text) => setCurrentLocation(prev => ({...prev, name: text}))}
                  placeholder="Location Name (Home, Office, etc.)"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

              <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
                <View style={styles.sectionLabelRow}>
                  <Icon name="search" size={15} color={colors.accent} />
                  <Text style={[styles.sectionLabel, {color: colors.text}]}>Address</Text>
                </View>
                <AddressAutocomplete
                  value={fullAddress}
                  onChangeText={setFullAddress}
                  onSelectAddress={handleAddressSelect}
                  placeholder="Search for address"
                  label=""
                />
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: theme.spacing.sm}]}
                  value={currentLocation.addressLine1}
                  onChangeText={(text) => setCurrentLocation(prev => ({...prev, addressLine1: text}))}
                  placeholder="Address Line 1 *"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: theme.spacing.sm}]}
                  value={currentLocation.addressLine2}
                  onChangeText={(text) => setCurrentLocation(prev => ({...prev, addressLine2: text}))}
                  placeholder="Address Line 2 (optional)"
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.textInput, styles.flex, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: theme.spacing.sm}]}
                    value={currentLocation.city}
                    onChangeText={(text) => setCurrentLocation(prev => ({...prev, city: text}))}
                    placeholder="City *"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    style={[styles.textInput, {width: 70, backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: theme.spacing.sm}]}
                    value={currentLocation.state}
                    onChangeText={(text) => setCurrentLocation(prev => ({...prev, state: text}))}
                    placeholder="State"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
                <TextInput
                  style={[styles.textInput, {width: 120, backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: theme.spacing.sm}]}
                  value={currentLocation.zipcode}
                  onChangeText={(text) => setCurrentLocation(prev => ({...prev, zipcode: text}))}
                  placeholder="ZIP Code"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View style={[styles.megaDivider, {backgroundColor: colors.divider}]} />

              <View style={[styles.megaSection, {backgroundColor: colors.surface}]}>
                <TouchableOpacity
                  style={[styles.checkboxRow, {backgroundColor: colors.background, borderColor: colors.border}]}
                  onPress={() => setCurrentLocation(prev => ({...prev, isPrimary: !prev.isPrimary}))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, {borderColor: colors.border}, currentLocation.isPrimary && [styles.checkboxChecked, {backgroundColor: colors.accent, borderColor: colors.accent}]]}>
                    {currentLocation.isPrimary && (
                      <Icon name="check" size={14} color={colors.textLight} />
                    )}
                  </View>
                  <Text style={[styles.checkboxLabel, {color: colors.text}]}>Set as primary location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
          
          <View style={[styles.modalFooter, {borderTopColor: colors.border}]}>
            <Button
              title="Save Location"
              onPress={handleSaveLocation}
            />
          </View>
        </SafeAreaView>
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
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },

  // ═══ HEADER ═══
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  headerPillText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },

  // ═══ MEGA CARD ═══
  megaCard: {
    borderRadius: theme.borderRadius.xxl,
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
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section (legacy)
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },

  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },

  // Input
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
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },

  // Bottom Bar
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  // Locations
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  addButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textLight,
    marginLeft: theme.spacing.xs,
  },
  locationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  locationName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  primaryBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  primaryText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textLight,
  },
  locationActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  locationAddress: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  locationCity: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  emptyLocations: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  // Modal
  modalContainer: {
    flex: 1,

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
  modalContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  modalScrollContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  addPillText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  modalFooter: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  checkboxChecked: {
  },
  checkboxLabel: {
    fontSize: theme.fontSize.md,

  },
});
