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
import { ScreenHeader, AnimatedPressable } from '../components/ui';
import { contactImportService, DeviceContact, PermissionStatus } from '../services/contactImportService';
import type { TeamContactImportScreenProps } from '../types/navigation';

type ScreenState = 'permission' | 'loading' | 'list';

// Contact Card Component (single select, no checkbox)
interface ContactCardProps {
  contact: DeviceContact;
  onPress: () => void;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, onPress }) => {
  const { colors } = useTheme();
  return (
    <AnimatedPressable style={[styles.contactCard, {backgroundColor: colors.surface}]} onPress={onPress}>
      <View style={styles.cardHeader}>
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

        {/* Chevron */}
        <Icon name="chevron-right" size={20} color={colors.textSecondary} />
      </View>

      <View style={[styles.cardContent, {backgroundColor: colors.surface}]}>
        {contact.phone ? (
          <View style={styles.contactRow}>
            <Icon name="phone" size={14} color={colors.textSecondary} />
            <Text style={[styles.contactText, {color: colors.text}]}>{contact.phone}</Text>
          </View>
        ) : (
          <View style={styles.contactRow}>
            <Icon name="phone" size={14} color={colors.warning} />
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
            <Icon name="mail" size={14} color={colors.warning} />
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
      Select a contact to quickly add them as a team member. Their name, phone, and email will be pre-filled.
    </Text>
    {permissionStatus === 'denied' || permissionStatus === 'restricted' ? (
      <>
        <Text style={[styles.permissionWarning, {color: colors.text}]}>
          Permission was denied. Please enable contacts access in your device settings.
        </Text>
        <TouchableOpacity style={[styles.permissionButton, {backgroundColor: colors.accent}]} onPress={onOpenSettings}>
          <Icon name="settings" size={18} color={colors.textLight} />
          <Text style={[styles.permissionButtonText, {color: colors.text}]}>Open Settings</Text>
        </TouchableOpacity>
      </>
    ) : (
      <TouchableOpacity style={[styles.permissionButton, {backgroundColor: colors.accent}]} onPress={onRequestPermission}>
        <Icon name="unlock" size={18} color={colors.textLight} />
        <Text style={[styles.permissionButtonText, {color: colors.text}]}>Allow Access</Text>
      </TouchableOpacity>
    )}
  </View>
  );
};

export const TeamContactImportScreen: React.FC<TeamContactImportScreenProps> = ({ navigation }) => {
  const [screenState, setScreenState] = useState<ScreenState>('permission');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undefined');
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const status = await contactImportService.checkPermission();
      setPermissionStatus(status);
      if (status === 'authorized') {
        loadContacts();
      }
    };
    checkPermission();
  }, []);

  // Load contacts from device
  const loadContacts = async () => {
    setScreenState('loading');
    try {
      const deviceContacts = await contactImportService.getContacts();
      const validContacts = contactImportService.filterValidContacts(deviceContacts);
      setContacts(validContacts);
      setScreenState('list');
    } catch (error) {
      console.error('[TeamContactImportScreen] Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
      setScreenState('permission');
    }
  };

  // Request permission
  const handleRequestPermission = async () => {
    const status = await contactImportService.requestPermission();
    setPermissionStatus(status);
    if (status === 'authorized') {
      loadContacts();
    }
  };

  // Open settings
  const handleOpenSettings = () => {
    contactImportService.openSettings();
  };

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    return contactImportService.filterBySearchTerm(contacts, searchQuery);
  }, [contacts, searchQuery]);

  // Handle contact selection - navigate to InviteTeamMember with pre-filled data
  const handleSelectContact = useCallback((contact: DeviceContact) => {
    // Navigate to InviteTeamMember screen with contact data
    navigation.replace('InviteTeamMember', {
      fullName: contact.contactName || contact.displayName,
      email: contact.email || '',
      phone: contact.phone || '',
    });
  }, [navigation]);

  // Render contact card
  const renderContact = useCallback(
    ({ item }: { item: DeviceContact }) => (
      <ContactCard
        contact={item}
        onPress={() => handleSelectContact(item)}
      />
    ),
    [handleSelectContact]
  );

  const { colors, isDark } = useTheme();

  // Render permission view
  if (screenState === 'permission') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Select Contact" onBack={() => navigation.goBack()} />
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
        <ScreenHeader title="Select Contact" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading contacts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render list view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="Select Contact"
        subtitle="Tap to add as team member"
        onBack={() => navigation.goBack()}
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

      {/* Info Bar */}
      <View style={[styles.infoBar, {backgroundColor: colors.surface}]}>
        <Icon name="info" size={16} color={colors.accent} />
        <Text style={[styles.infoText, {color: colors.text}]}>
          {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} available
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
              {searchQuery ? 'No contacts match your search' : 'No contacts found'}
            </Text>
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

  // Info Bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  infoText: {
    fontSize: theme.fontSize.sm,

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
    width: 44,
    height: 44,
    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: theme.fontSize.lg,
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
  cardContent: {
    gap: theme.spacing.xs,
    paddingLeft: 52, // Align with text after avatar
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

export default TeamContactImportScreen;
