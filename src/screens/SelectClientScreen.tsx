import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {useClient} from '../context/ClientContext';
import {useEstimate} from '../context/EstimateContext';
import {ScreenHeader, AnimatedPressable} from '../components/ui';
import type {SelectClientScreenProps} from '../types/navigation';
import type {ClientListItem} from '../types/apiResponses';

// Client Card
interface ClientCardProps {
  client: ClientListItem;
  isSelected: boolean;
  onPress: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({client, isSelected, onPress}) => {
  const { colors } = useTheme();
  return (
  <AnimatedPressable
    style={[styles.clientCard, {backgroundColor: colors.surface, borderColor: isSelected ? colors.accent : colors.border}, isSelected && styles.clientCardSelected]}
    onPress={onPress}>
    <View style={[styles.clientAvatar, {backgroundColor: `${colors.accent}20`}]}>
      <Text style={[styles.clientAvatarText, {color: colors.accent}]}>
        {client.contactName.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.clientInfo}>
      <Text style={[styles.clientName, {color: colors.text}]}>{client.contactName}</Text>
      {client.companyName && (
        <Text style={[styles.clientCompany, {color: colors.textSecondary}]}>{client.companyName}</Text>
      )}
      <View style={styles.clientDetails}>
        {client.email && (
          <Text style={[styles.clientDetail, {color: colors.textSecondary}]} numberOfLines={1}>
            {client.email}
          </Text>
        )}
      </View>
    </View>
    {isSelected ? (
      <View style={[styles.checkIcon, {backgroundColor: colors.accent}]}>
        <Icon name="check" size={16} color={colors.textLight} />
      </View>
    ) : (
      <Icon name="chevron-right" size={20} color={colors.textSecondary} />
    )}
  </AnimatedPressable>
  );
};

export const SelectClientScreen: React.FC<SelectClientScreenProps> = ({navigation}) => {
  const {clients, loadClients, loading} = useClient();
  const {draftEstimate, updateDraft} = useEstimate();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Reload clients when screen receives focus (handles coming back from CreateClient)
  useFocusEffect(
    useCallback(() => {
      console.log('[SelectClientScreen] Screen focused, reloading clients');
      loadClients(true);
    }, [loadClients])
  );

  // Filter clients by search
  const filteredClients = clients.filter(client => {
    if (!searchQuery) {return true;}
    const query = searchQuery.toLowerCase();
    return (
      client.contactName.toLowerCase().includes(query) ||
      client.companyName?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadClients(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadClients]);

  // Handle select client
  const handleSelectClient = useCallback((client: ClientListItem) => {
    updateDraft({
      clientId: client.id,
      client: client, // Pass full client object so name displays correctly
      locationId: undefined, // Reset location when client changes
    });
    navigation.goBack();
  }, [updateDraft, navigation]);

  // Handle create new client
  const handleCreateClient = useCallback(() => {
    navigation.navigate('CreateClient');
  }, [navigation]);

  // Handle import contacts
  const handleImportContacts = useCallback(() => {
    navigation.navigate('ContactImport');
  }, [navigation]);

  // Render client
  const renderClient = useCallback(({item}: {item: ClientListItem}) => (
    <ClientCard
      client={item}
      isSelected={draftEstimate?.clientId === item.id}
      onPress={() => handleSelectClient(item)}
    />
  ), [draftEstimate?.clientId, handleSelectClient]);

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="Select Client"
        subtitle={`${clients.length} clients`}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            style={[styles.addButton, {backgroundColor: colors.accent}]}
            onPress={handleCreateClient}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="plus" size={22} color={colors.textLight} />
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, {backgroundColor: colors.background}]}>
        <View style={[styles.searchBar, {backgroundColor: colors.surface}]}>

          <Icon name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
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

      {/* Client List */}
      <FlatList
        data={filteredClients}
        renderItem={renderClient}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) :
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, {backgroundColor: `${colors.accent}15`}]}>
              <Icon name="users" size={40} color={colors.accent} />
            </View>
            {!searchQuery ? (
              <View style={styles.emptyButtonsContainer}>
                <TouchableOpacity style={[styles.emptyButton, {backgroundColor: colors.accent}]} onPress={handleCreateClient}>
                  <Icon name="user-plus" size={20} color={colors.textLight} />
                  <Text style={[styles.emptyButtonText, {color: colors.textLight}]}>Create New Client</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.importButton, {backgroundColor: colors.surface, borderColor: colors.border}]} onPress={handleImportContacts}>
                  <Icon name="smartphone" size={20} color={colors.accent} />
                  <Text style={[styles.importButtonText, {color: colors.accent}]}>Import from Contacts</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.emptySearchHint, {color: colors.textSecondary}]}>No results for "{searchQuery}"</Text>
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

  // Add Button
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,

    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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

  // List
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },

  // Client Card
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  clientCardSelected: {
    borderWidth: 2,

  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  clientAvatarText: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  clientCompany: {
    fontSize: theme.fontSize.sm,

    marginTop: 2,
  },
  clientDetails: {
    flexDirection: 'row',
    marginTop: 4,
  },
  clientDetail: {
    fontSize: theme.fontSize.xs,

  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyButtonsContainer: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  emptyButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    gap: theme.spacing.sm,
  },
  importButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  emptySearchHint: {
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
});
