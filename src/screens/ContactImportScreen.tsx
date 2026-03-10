import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useClient } from '../context/ClientContext';
import { ScreenHeader, AnimatedPressable } from '../components/ui';
import { contactImportService, DeviceContact, PermissionStatus } from '../services/contactImportService';
import { clientService } from '../services/api/domain/clients/clientService';
import type { ContactImportScreenProps } from '../types/navigation';
import type { CreateClientVM } from '../types/apiRequests';

type ScreenState = 'permission' | 'loading' | 'list' | 'importing';

// Contact Card Component
interface ContactCardProps {
  contact: DeviceContact;
  isSelected: boolean;
  onToggle: () => void;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, isSelected, onToggle }) => {
  const { colors } = useTheme();
  return (
    <AnimatedPressable style={[styles.contactCard, {backgroundColor: colors.surface}]} onPress={onToggle}>
      <View style={styles.cardHeader}>
        {/* Checkbox */}
        <TouchableOpacity
          style={[styles.checkbox, isSelected && [styles.checkboxSelected, {backgroundColor: colors.accent}]]}
          onPress={onToggle}>
          {isSelected && <Icon name="check" size={14} color={colors.textLight} />}
        </TouchableOpacity>

        {/* Avatar */}
        <View style={[styles.avatarWrap, {backgroundColor: colors.surface}]}>
          <Text style={[styles.avatarText, {color: colors.text}]}>
            {contact.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Contact Info */}
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, {color: colors.text}]} numberOfLines={1}>
            {contact.displayName}
          </Text>
          {contact.companyName && (
            <Text style={[styles.companyName, {color: colors.text}]} numberOfLines={1}>
              {contact.companyName}
            </Text>
          )}
        </View>

        {/* Warning badge for missing fields */}
        {!contact.hasRequiredFields && (
          <View style={[styles.warningBadge, {backgroundColor: `${colors.warning}15`}]}>
            <Icon name="alert-circle" size={14} color={colors.warning} />
          </View>
        )}
      </View>

      <View style={[styles.cardContent, {backgroundColor: colors.surface}]}>
        {contact.phone ? (
          <View style={styles.contactRow}>
            <Icon name="phone" size={14} color={colors.textSecondary} />
            <Text style={[styles.contactText, {color: colors.text}]}>{contact.phone}</Text>
          </View>
        ) : (
          <View style={styles.contactRow}>
            <Icon name="phone" size={14} color={colors.error} />
            <Text style={[styles.contactText, {color: colors.text}, styles.missingText]}>No phone</Text>
          </View>
        )}
        {contact.email ? (
          <View style={styles.contactRow}>
            <Icon name="mail" size={14} color={colors.textSecondary} />
            <Text style={[styles.contactText, {color: colors.text}]}>{contact.email}</Text>
          </View>
        ) : (
          <View style={styles.contactRow}>
            <Icon name="mail" size={14} color={colors.error} />
            <Text style={[styles.contactText, {color: colors.text}, styles.missingText]}>No email</Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};

// Permission Screen Component
interface PermissionViewProps {
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  permissionStatus: PermissionStatus;
}

const PermissionView: React.FC<PermissionViewProps> = ({
  onRequestPermission,
  onOpenSettings,
  permissionStatus,
}) => {
  const { colors } = useTheme();
  return (
  <View style={[styles.permissionContainer, {backgroundColor: colors.surface}]}>
    <View style={[styles.permissionIconWrap, {backgroundColor: colors.surface}]}>
      <Icon name="users" size={48} color={colors.accent} />
    </View>
    <Text style={[styles.permissionTitle, {color: colors.text}]}>Access Your Contacts</Text>
    <Text style={[styles.permissionSubtitle, {color: colors.text}]}>
      SilkRoad needs access to your contacts to import them as clients. This makes it easy to create estimates and jobs for your existing contacts.
    </Text>
    {permissionStatus === 'denied' || permissionStatus === 'restricted' ? (
      <>
        <Text style={[styles.permissionWarning, {color: colors.text}]}>
          Permission was denied. Please enable contacts access in your device settings.
        </Text>
        <TouchableOpacity style={[styles.permissionButton, {backgroundColor: colors.accent}]} onPress={onOpenSettings}>
          <Icon name="settings" size={18} color={colors.textLight} />
          <Text style={[styles.permissionButtonText, {color: colors.textLight}]}>Open Settings</Text>
        </TouchableOpacity>
      </>
    ) : (
      <TouchableOpacity style={[styles.permissionButton, {backgroundColor: colors.accent}]} onPress={onRequestPermission}>
        <Icon name="unlock" size={18} color={colors.textLight} />
        <Text style={[styles.permissionButtonText, {color: colors.textLight}]}>Allow Access</Text>
      </TouchableOpacity>
    )}
  </View>
  );
};

export const ContactImportScreen: React.FC<ContactImportScreenProps> = ({ navigation }) => {
  const { loadClients } = useClient();
  const [screenState, setScreenState] = useState<ScreenState>('permission');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undefined');
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      console.log('[ContactImport] Checking permission...');
      try {
        const status = await contactImportService.checkPermission();
        console.log('[ContactImport] Permission status:', status);
        setPermissionStatus(status);
        if (status === 'authorized') {
          loadContacts();
        }
      } catch (err) {
        console.error('[ContactImport] Error checking permission:', err);
      }
    };
    checkPermission();
  }, []);

  // Load contacts from device
  const loadContacts = async () => {
    console.log('[ContactImport] Loading contacts...');
    setScreenState('loading');
    try {
      const deviceContacts = await contactImportService.getContacts();
      console.log('[ContactImport] Raw contacts loaded:', deviceContacts.length);
      const validContacts = contactImportService.filterValidContacts(deviceContacts);
      console.log('[ContactImport] Valid contacts after filter:', validContacts.length);
      setContacts(validContacts);
      setScreenState('list');
    } catch (error) {
      console.error('[ContactImport] Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
      setScreenState('permission');
    }
  };

  // Request permission
  const handleRequestPermission = async () => {
    console.log('[ContactImport] Requesting permission...');
    try {
      const status = await contactImportService.requestPermission();
      console.log('[ContactImport] Permission result:', status);
      setPermissionStatus(status);
      if (status === 'authorized') {
        loadContacts();
      } else {
        console.warn('[ContactImport] Permission not granted:', status);
        Alert.alert(
          'Permission Required',
          'Contacts access was not granted. Please allow access in Settings to import contacts.',
        );
      }
    } catch (err) {
      console.error('[ContactImport] Error requesting permission:', err);
      Alert.alert('Error', 'Failed to request contacts permission.');
    }
  };

  // Open settings
  const handleOpenSettings = () => {
    contactImportService.openSettings();
  };

  // Toggle contact selection
  const handleToggleContact = useCallback((contactId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  }, []);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    return contactImportService.filterBySearchTerm(contacts, searchQuery);
  }, [contacts, searchQuery]);

  // Select all / Deselect all
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  }, [selectedIds.size, filteredContacts]);

  // Get selected contacts
  const selectedContacts = useMemo(() => {
    return contacts.filter(c => selectedIds.has(c.id));
  }, [contacts, selectedIds]);

  // Import selected contacts
  const handleImport = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('No Selection', 'Please select at least one contact to import.');
      return;
    }

    // Check for contacts without name
    const invalidContacts = selectedContacts.filter(c => !c.contactName || c.contactName === 'Unknown');
    if (invalidContacts.length > 0) {
      Alert.alert(
        'Invalid Contacts',
        `${invalidContacts.length} contact(s) have no name and cannot be imported.`
      );
      return;
    }

    setScreenState('importing');

    try {
      // Map selected contacts to CreateClientVM
      const clientsToCreate: CreateClientVM[] = selectedContacts.map(contact => ({
        contactName: contact.contactName,
        phone: contact.phone || '',
        email: contact.email || '',
        companyName: contact.companyName || '',
      }));

      const result = await clientService.bulkCreateClients({ clients: clientsToCreate });

      // Reload clients in context
      await loadClients();

      // Build success message
      let successMessage = '';
      if (result.totalCreated > 0) {
        successMessage = `${result.totalCreated} client${result.totalCreated > 1 ? 's' : ''} imported successfully`;
        if (result.totalDuplicates > 0) {
          successMessage += ` (${result.totalDuplicates} duplicate${result.totalDuplicates > 1 ? 's' : ''} skipped)`;
        }
      } else if (result.totalDuplicates > 0) {
        successMessage = `All ${result.totalDuplicates} contact${result.totalDuplicates > 1 ? 's were' : ' was'} already in your clients list`;
      } else {
        successMessage = 'No contacts were imported';
      }

      // Navigate to ClientsList with success message
      navigation.replace('ClientsList', { importSuccessMessage: successMessage });
    } catch (error: any) {
      console.error('[ContactImportScreen] Import error:', error);
      Alert.alert('Import Failed', error.message || 'Failed to import contacts. Please try again.');
      setScreenState('list');
    }
  };

  // Go back handler
  const handleGoBack = useCallback(() => {
    if (screenState === 'list' && selectedIds.size > 0) {
      Alert.alert(
        'Discard Selection?',
        'You have contacts selected. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [navigation, screenState, selectedIds.size]);

  // Render contact card
  const renderContact = useCallback(
    ({ item }: { item: DeviceContact }) => (
      <ContactCard
        contact={item}
        isSelected={selectedIds.has(item.id)}
        onToggle={() => handleToggleContact(item.id)}
      />
    ),
    [selectedIds, handleToggleContact]
  );

  const { colors, isDark } = useTheme();

  // Render permission view
  if (screenState === 'permission') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Import Contacts" onBack={handleGoBack} />
        <PermissionView
          permissionStatus={permissionStatus}
          onRequestPermission={handleRequestPermission}
          onOpenSettings={handleOpenSettings}
        />
      </SafeAreaView>
    );
  }

  // Render loading view
  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Import Contacts" onBack={handleGoBack} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render importing view
  if (screenState === 'importing') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Import Contacts" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Importing {selectedContacts.length} contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render list view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="Import Contacts"
        subtitle={`${selectedIds.size} selected`}
        onBack={handleGoBack}
        rightAction={
          <TouchableOpacity
            style={[
              styles.importButton,
              selectedIds.size === 0 && [styles.importButtonDisabled, {opacity: 0.5}],
            ]}
            onPress={handleImport}
            disabled={selectedIds.size === 0}>
            <Icon
              name="download"
              size={18}
              color={selectedIds.size > 0 ? colors.textLight : colors.textSecondary}
            />
            <Text
              style={[
                styles.importButtonText,
                selectedIds.size === 0 && [styles.importButtonTextDisabled, {color: colors.textSecondary}],
              ]}>
              Import
            </Text>
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, {backgroundColor: colors.background}]}>
        <View style={[styles.searchBar, {backgroundColor: colors.background}]}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput             style={[styles.searchInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
            placeholder="Search contacts..."
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

      {/* Select All / Info Bar */}
      <View style={[styles.selectAllContainer, {backgroundColor: colors.surface}]}>
        <TouchableOpacity style={styles.selectAllButton} onPress={handleSelectAll}>
          <View
            style={[
              styles.checkbox,
              selectedIds.size === filteredContacts.length &&
                filteredContacts.length > 0 &&
                [styles.checkboxSelected, {backgroundColor: colors.accent}],
            ]}>
            {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 && (
              <Icon name="check" size={14} color={colors.textLight} />
            )}
          </View>
          <Text style={[styles.selectAllText, {color: colors.text}]}>
            {selectedIds.size === filteredContacts.length && filteredContacts.length > 0
              ? 'Deselect All'
              : 'Select All'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.contactCountText, {color: colors.text}]}>
          {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        renderItem={renderContact}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="users" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
              {searchQuery ? 'No contacts match your search' : 'No contacts found on this device'}
            </Text>
            {!searchQuery && (
              <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>
                Make sure your device has contacts saved. If using a simulator, add contacts in the Contacts app first.
              </Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },

  // Import Button
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  importButtonDisabled: {
  },
  importButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

  },
  importButtonTextDisabled: {
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

  // Select All
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  selectAllText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  contactCountText: {
    fontSize: theme.fontSize.sm,

  },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
  },

  // List
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },

  // Contact Card
  contactCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,

  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  companyName: {
    fontSize: theme.fontSize.sm,

    marginTop: 1,
  },
  warningBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    gap: theme.spacing.xs,
    paddingLeft: 54, // Align with text after checkbox + avatar
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  contactText: {
    fontSize: theme.fontSize.sm,

  },
  missingText: {

    fontStyle: 'italic',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 20,
  },

  // Permission View
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  permissionIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,

    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  permissionTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    maxWidth: 320,
    lineHeight: 22,
  },
  permissionWarning: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    marginBottom: theme.spacing.md,
    maxWidth: 280,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  permissionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },

  // Loading View
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: theme.fontSize.md,

    marginTop: theme.spacing.md,
  },
});

export default ContactImportScreen;
