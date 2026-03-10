import React, {useCallback, useState, useEffect} from 'react';
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
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useClient} from '../context/ClientContext';
import {Button} from '../components/Button';
import {ScreenHeader, ConfirmationModal} from '../components/ui';
import {AddressAutocomplete} from '../components/AddressAutocomplete';
import type {EditClientScreenProps} from '../types/navigation';
import type {GeocodingResult} from '../services/geocodingService';
// LocationRM type available from '../types/apiResponses' if needed

export const EditClientScreen: React.FC<EditClientScreenProps> = ({navigation, route}) => {
  const {clientId} = route.params;
  const {
    updateClient,
    getClientById,
    createLocation,
    updateLocation,
    deleteLocation,
    loadClientLocations,
    clientLocations,
    loading: clientLoading,
  } = useClient();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(true);

  // Form state
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Locations list state
  interface LocationData {
    id?: string; // ID for existing locations
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
    isNew?: boolean; // Flag for newly added locations
    isDeleted?: boolean; // Flag for locations to be deleted
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

  // Load existing client data
  useEffect(() => {
    const loadClientData = async () => {
      try {
        setIsLoadingClient(true);
        const client = await getClientById(clientId);

        if (client) {
          setContactName(client.contactName || '');
          setEmail(client.email || '');
          setPhone(client.phone || '');
          setCompanyName(client.companyName || '');
        }

        // Load locations
        await loadClientLocations(clientId);
      } catch (error) {
        console.error('[EditClientScreen] Error loading client:', error);
        Alert.alert('Error', 'Failed to load client data');
        navigation.goBack();
      } finally {
        setIsLoadingClient(false);
      }
    };

    loadClientData();
  }, [clientId, getClientById, loadClientLocations, navigation]);

  // Update locations when clientLocations changes
  useEffect(() => {
    if (clientLocations && clientLocations.length > 0) {
      const mappedLocations: LocationData[] = clientLocations.map(loc => ({
        id: loc.id,
        name: loc.name || '',
        addressLine1: loc.addressLine1 || '',
        addressLine2: loc.addressLine2 || '',
        city: loc.city || '',
        state: loc.state || '',
        zipcode: loc.zipcode || '',
        country: loc.country || 'USA',
        latitude: loc.latitude,
        longitude: loc.longitude,
        isPrimary: loc.isPrimary || false,
        isNew: false,
        isDeleted: false,
      }));
      setLocations(mappedLocations);
    }
  }, [clientLocations]);

  // Validation
  const isValid = contactName.trim() && email.trim() && phone.trim();

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isValid) {
      return;
    }

    try {
      // Update client info
      await updateClient(clientId, {
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        companyName: companyName.trim() || undefined,
      });

      console.log('[EditClientScreen] Client updated:', clientId);

      // Handle location changes
      for (const loc of locations) {
        if (loc.isDeleted && loc.id) {
          // Delete existing location
          try {
            await deleteLocation(clientId, loc.id);
            console.log('[EditClientScreen] Location deleted:', loc.id);
          } catch (error) {
            console.error('[EditClientScreen] Error deleting location:', error);
          }
        } else if (loc.isNew && !loc.isDeleted) {
          // Create new location
          try {
            await createLocation(clientId, {
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
            console.log('[EditClientScreen] Location created:', loc.name);
          } catch (error) {
            console.error('[EditClientScreen] Error creating location:', error);
          }
        } else if (loc.id && !loc.isDeleted) {
          // Update existing location
          try {
            await updateLocation(clientId, loc.id, {
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
            console.log('[EditClientScreen] Location updated:', loc.id);
          } catch (error) {
            console.error('[EditClientScreen] Error updating location:', error);
          }
        }
      }

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error updating client:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update client. Please try again.',
        [{text: 'OK'}]
      );
    }
  }, [
    isValid,
    clientId,
    contactName,
    email,
    phone,
    companyName,
    locations,
    updateClient,
    createLocation,
    updateLocation,
    deleteLocation,
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
      isPrimary: locations.filter(l => !l.isDeleted).length === 0, // First location is primary by default
      isNew: true,
    });
    setFullAddress('');
    setShowLocationModal(true);
  }, [locations]);

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
            const location = locations[index];
            if (location.id) {
              // Mark existing location for deletion
              const updated = [...locations];
              updated[index] = {...location, isDeleted: true};

              // If deleted location was primary, make first non-deleted one primary
              if (location.isPrimary) {
                const firstNonDeleted = updated.find(l => !l.isDeleted);
                if (firstNonDeleted) {
                  firstNonDeleted.isPrimary = true;
                }
              }
              setLocations(updated);
            } else {
              // Remove new location from list entirely
              const newLocations = locations.filter((_, i) => i !== index);
              // If deleted location was primary, make first one primary
              if (location.isPrimary && newLocations.length > 0) {
                newLocations[0].isPrimary = true;
              }
              setLocations(newLocations);
            }
          },
        },
      ]
    );
  }, [locations]);

  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback((address: GeocodingResult) => {
    console.log('[EditClientScreen] Address selected:', address);
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

  // Get visible locations (not deleted)
  const visibleLocations = locations.filter(l => !l.isDeleted);

  const { colors, isDark } = useTheme();

  if (isLoadingClient) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader
          title="Edit Client"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading client data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="Edit Client"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">

          {/* Contact Info Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Contact Information</Text>
            <View style={[styles.card, {backgroundColor: colors.surface}]}>
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
          </View>

          {/* Locations Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Locations</Text>
                <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
                  {visibleLocations.length === 0 ? 'Add client job locations' : `${visibleLocations.length} location(s)`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleAddLocation}
                style={[styles.addButton, {backgroundColor: colors.accent}]}
                activeOpacity={0.7}
              >
                <Icon name="plus" size={20} color={colors.textLight} />
                <Text style={[styles.addButtonText, {color: colors.textLight}]}>Add Location</Text>
              </TouchableOpacity>
            </View>

            {visibleLocations.map((loc, index) => {
              // Find actual index in full locations array
              const actualIndex = locations.findIndex(l => l === loc);
              return (
                <View key={loc.id || `new-${index}`} style={[styles.locationCard, {backgroundColor: colors.surface}]}>
                  <View style={styles.locationHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1}}>
                      <Icon name="map-pin" size={16} color={colors.accent} />
                      <Text style={[styles.locationName, {color: colors.text}]} numberOfLines={2}>
                        {loc.name || `${loc.addressLine1}, ${loc.city}, ${loc.state} ${loc.zipcode}`}
                      </Text>
                    </View>
                    <View style={styles.locationActions}>
                      {loc.isPrimary && (
                        <View style={[styles.primaryBadge, {backgroundColor: `${colors.accent}15`}]}>
                          <Text style={[styles.primaryText, {color: colors.accent}]}>Primary</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => handleEditLocation(actualIndex)}
                        style={styles.iconButton}
                      >
                        <Icon name="edit-2" size={16} color={colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteLocation(actualIndex)}
                        style={styles.iconButton}
                      >
                        <Icon name="trash-2" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Only show address details if name is different from addressLine1 */}
                  {loc.name && !loc.name.includes(loc.addressLine1) && (
                    <Text style={[styles.locationAddress, {color: colors.textSecondary, marginLeft: 22}]}>
                      {loc.addressLine1}
                      {loc.addressLine2 ? `, ${loc.addressLine2}` : ''}
                      {loc.city ? `, ${loc.city}, ${loc.state} ${loc.zipcode}` : ''}
                    </Text>
                  )}
                </View>
              );
            })}

            {visibleLocations.length === 0 && (
              <View style={[styles.emptyLocations, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Icon name="map" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No locations added yet</Text>
                <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>Tap "Add Location" to get started</Text>
              </View>
            )}
          </View>

        </ScrollView>

        {/* Save Button */}
        <View style={[styles.bottomBar, {backgroundColor: colors.surface}]}>
          <Button
            title={clientLoading ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            loading={clientLoading}
            disabled={!isValid || clientLoading}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        title="Client Updated!"
        message="The client information has been updated successfully."
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

          <ScrollView style={[styles.modalContent, {backgroundColor: colors.surface}]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Location Name (Optional)</Text>
              <TextInput
                style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={currentLocation.name}
                onChangeText={(text) => setCurrentLocation(prev => ({...prev, name: text}))}
                placeholder="Home, Office, etc."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <AddressAutocomplete
              value={fullAddress}
              onChangeText={setFullAddress}
              onSelectAddress={handleAddressSelect}
              placeholder="Search for address"
              label="Address Search"
            />

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Address Line 1 *</Text>
              <TextInput
                style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={currentLocation.addressLine1}
                onChangeText={(text) => setCurrentLocation(prev => ({...prev, addressLine1: text}))}
                placeholder="123 Main Street"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Address Line 2</Text>
              <TextInput
                style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={currentLocation.addressLine2}
                onChangeText={(text) => setCurrentLocation(prev => ({...prev, addressLine2: text}))}
                placeholder="Apt, Suite, etc."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>City *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={currentLocation.city}
                  onChangeText={(text) => setCurrentLocation(prev => ({...prev, city: text}))}
                  placeholder="City"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, {width: 80}]}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>State *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={currentLocation.state}
                  onChangeText={(text) => setCurrentLocation(prev => ({...prev, state: text}))}
                  placeholder="TX"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>ZIP Code</Text>
              <TextInput
                style={[styles.textInput, {width: 120, backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                value={currentLocation.zipcode}
                onChangeText={(text) => setCurrentLocation(prev => ({...prev, zipcode: text}))}
                placeholder="12345"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.checkboxRow, {backgroundColor: colors.surface}]}
              onPress={() => setCurrentLocation(prev => ({...prev, isPrimary: !prev.isPrimary}))}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, {borderColor: colors.border}, currentLocation.isPrimary && {backgroundColor: colors.accent, borderColor: colors.accent}]}>
                {currentLocation.isPrimary && (
                  <Icon name="check" size={16} color={colors.textLight} />
                )}
              </View>
              <Text style={[styles.checkboxLabel, {color: colors.text}]}>Set as primary location</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.modalFooter, {backgroundColor: colors.surface}, {borderTopColor: colors.border}]}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },

  // Section
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.sm,
  },

  // Card
  card: {

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

    borderTopWidth: 1,

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

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  addButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginLeft: theme.spacing.xs,
  },
  locationCard: {

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

    flex: 1,
  },
  primaryBadge: {

    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  primaryText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,

  },
  locationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  locationAddress: {
    fontSize: theme.fontSize.sm,

    marginBottom: 2,
  },
  locationCity: {
    fontSize: theme.fontSize.sm,

  },
  emptyLocations: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    borderStyle: 'dashed',
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
  modalFooter: {
    padding: theme.spacing.md,
    borderTopWidth: 1,

  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,

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
    backgroundColor: '#004732',
    borderColor: '#004732',
  },
  checkboxLabel: {
    fontSize: theme.fontSize.md,

  },
});
