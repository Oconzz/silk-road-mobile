import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { clientService } from '../services/api/domain/clients/clientService';
import { StorageService } from '../services/api/shared/utils';
import { useAuth } from './AuthContext';
import type {
  CreateClientVM,
  UpdateClientVM,
  CreateLocationVM,
  UpdateLocationVM,
} from '../types/apiRequests';
import type {
  ClientRM,
  ClientListItem,
  LocationRM,
} from '../types/apiResponses';

interface ClientContextType {
  clients: ClientListItem[];
  selectedClient: ClientRM | null;
  locations: LocationRM[];
  clientLocations: LocationRM[]; // Alias for locations (used by EditClientScreen)
  loading: boolean;
  error: string | null;
  
  // Client operations
  loadClients: (forceRefresh?: boolean) => Promise<void>;
  getClientById: (id: string) => Promise<ClientRM | null>;
  createClient: (data: CreateClientVM) => Promise<ClientRM>;
  updateClient: (id: string, data: Omit<UpdateClientVM, 'id'>) => Promise<ClientRM>;
  deleteClient: (id: string) => Promise<void>;
  selectClient: (client: ClientRM | null) => void;
  searchClients: (query: string) => Promise<ClientListItem[]>;
  
  // Location operations
  loadClientLocations: (clientId: string) => Promise<void>;
  createLocation: (clientId: string, data: CreateLocationVM) => Promise<LocationRM>;
  updateLocation: (clientId: string, locationId: string, data: UpdateLocationVM) => Promise<LocationRM>;
  deleteLocation: (clientId: string, locationId: string) => Promise<void>;
  
  // Utility
  clearError: () => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const useClient = () => {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
};

interface ClientProviderProps {
  children: ReactNode;
}

export const ClientProvider: React.FC<ClientProviderProps> = ({ children }) => {
  const { isAuthenticated, currentCompany } = useAuth();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRM | null>(null);
  const [locations, setLocations] = useState<LocationRM[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use company-specific cache key for data isolation
  const cacheKey = currentCompany?.companyId
    ? `@nmj_${currentCompany.companyId}_clients`
    : '@nmj_default_clients';

  // Clear state when company changes to prevent data leaking between accounts
  useEffect(() => {
    setClients([]);
    setSelectedClient(null);
    setLocations([]);
    setError(null);
  }, [currentCompany?.companyId]);

  // Load clients from backend or cache
  const loadClients = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated || !currentCompany) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      if (!forceRefresh) {
        const cached = await StorageService.getData<ClientListItem[]>(cacheKey);
        if (cached && cached.length > 0) {
          setClients(cached);
        }
      }

      // Fetch from backend
      const response = await clientService.getClientList({
        pageSize: 100,
      });

      const data = response?.items || [];
      setClients(data);
      
      // Always update cache with current data (even if empty)
      await StorageService.setData(cacheKey, data);
    } catch (err: any) {
      console.error('Error loading clients:', err);
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentCompany, cacheKey]);

  // Get client by ID
  const getClientById = useCallback(async (id: string): Promise<ClientRM | null> => {
    try {
      setLoading(true);
      setError(null);

      const client = await clientService.getClientById(id);
      return client;
    } catch (err: any) {
      console.error('Error getting client:', err);
      setError(err.message || 'Failed to get client');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new client
  const createClient = useCallback(async (data: CreateClientVM): Promise<ClientRM> => {
    try {
      setLoading(true);
      setError(null);

      const newClient = await clientService.createClient(data);
      
      // Refresh the list
      await loadClients(true);
      
      return newClient;
    } catch (err: any) {
      console.error('Error creating client:', err);
      setError(err.message || 'Failed to create client');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadClients]);

  // Update client
  const updateClient = useCallback(async (id: string, data: Omit<UpdateClientVM, 'id'>): Promise<ClientRM> => {
    try {
      setLoading(true);
      setError(null);

      const updatedClient = await clientService.updateClient({ ...data, id });
      
      // Refresh the list
      await loadClients(true);
      
      // Update selected client if it's the one being updated
      if (selectedClient?.id === id) {
        setSelectedClient(updatedClient);
      }
      
      return updatedClient;
    } catch (err: any) {
      console.error('Error updating client:', err);
      setError(err.message || 'Failed to update client');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadClients, selectedClient]);

  // Delete client
  const deleteClient = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await clientService.deleteClient(id);
      
      // Remove from local state
      setClients(prev => prev.filter(c => c.id !== id));
      
      // Clear selected client if it's the one being deleted
      if (selectedClient?.id === id) {
        setSelectedClient(null);
      }
      
      // Update cache
      const updatedClients = clients.filter(c => c.id !== id);
      await StorageService.setData(cacheKey, updatedClients);
    } catch (err: any) {
      console.error('Error deleting client:', err);
      setError(err.message || 'Failed to delete client');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clients, selectedClient, cacheKey]);

  // Select a client
  const selectClient = useCallback((client: ClientRM | null) => {
    setSelectedClient(client);
  }, []);

  // Search clients
  const searchClients = useCallback(async (query: string): Promise<ClientListItem[]> => {
    try {
      setLoading(true);
      setError(null);

      const response = await clientService.searchClients(query);
      return response;
    } catch (err: any) {
      console.error('Error searching clients:', err);
      setError(err.message || 'Failed to search clients');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load client locations
  const loadClientLocations = useCallback(async (clientId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const clientLocations = await clientService.getClientLocations(clientId);
      setLocations(clientLocations);
    } catch (err: any) {
      console.error('Error loading locations:', err);
      setError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create location
  const createLocation = useCallback(async (
    clientId: string,
    data: CreateLocationVM
  ): Promise<LocationRM> => {
    try {
      setLoading(true);
      setError(null);

      const newLocation = await clientService.createLocation(clientId, data);
      
      // Refresh locations
      await loadClientLocations(clientId);
      
      return newLocation;
    } catch (err: any) {
      console.error('Error creating location:', err);
      setError(err.message || 'Failed to create location');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadClientLocations]);

  // Update location
  const updateLocation = useCallback(async (
    clientId: string,
    locationId: string,
    data: UpdateLocationVM
  ): Promise<LocationRM> => {
    try {
      setLoading(true);
      setError(null);

      const updatedLocation = await clientService.updateLocation({ ...data, id: locationId });
      
      // Refresh locations
      await loadClientLocations(clientId);
      
      return updatedLocation;
    } catch (err: any) {
      console.error('Error updating location:', err);
      setError(err.message || 'Failed to update location');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadClientLocations]);

  // Delete location
  const deleteLocation = useCallback(async (
    clientId: string,
    locationId: string
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await clientService.deleteLocation(locationId);
      
      // Remove from local state
      setLocations(prev => prev.filter(l => l.id !== locationId));
    } catch (err: any) {
      console.error('Error deleting location:', err);
      setError(err.message || 'Failed to delete location');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load clients on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      loadClients();
    }
  }, [isAuthenticated, currentCompany, loadClients]);

  const value: ClientContextType = {
    clients,
    selectedClient,
    locations,
    clientLocations: locations, // Alias for EditClientScreen compatibility
    loading,
    error,
    loadClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
    selectClient,
    searchClients,
    loadClientLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    clearError,
  };

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
};
