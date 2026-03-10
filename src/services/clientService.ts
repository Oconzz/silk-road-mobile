import { apiClient } from './api/core/httpClient';
import type {
  CreateClientVM,
  UpdateClientVM,
  ClientListRequestVM,
  CreateLocationVM,
  UpdateLocationVM,
} from '../types/apiRequests';
import type {
  ClientRM,
  ClientListItem,
  LocationRM,
  PagedResponse,
} from '../types/apiResponses';

export class ClientService {
  private readonly baseUrl = '/Client';

  async getClientList(
    request: ClientListRequestVM = {}
  ): Promise<PagedResponse<ClientListItem>> {
    try {
      const response = await apiClient.post<PagedResponse<ClientListItem>>(
        `${this.baseUrl}/list`,
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching client list:', error);
      throw error;
    }
  }

  async getClientById(id: string): Promise<ClientRM> {
    try {
      const response = await apiClient.get<ClientRM>(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching client:', error);
      throw error;
    }
  }

  async createClient(data: CreateClientVM): Promise<ClientRM> {
    try {
      const response = await apiClient.post<ClientRM>(
        `${this.baseUrl}/create`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error creating client:', error);
      throw error;
    }
  }

  async updateClient(data: UpdateClientVM): Promise<ClientRM> {
    try {
      const response = await apiClient.put<ClientRM>(
        `${this.baseUrl}/update`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating client:', error);
      throw error;
    }
  }

  async deleteClient(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`);
    } catch (error: any) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }

  // Location management
  async createLocation(clientId: string, data: CreateLocationVM): Promise<LocationRM> {
    try {
      console.log('[ClientService] Creating location for client:', clientId, data);
      const response = await apiClient.post<LocationRM>(
        `${this.baseUrl}/${clientId}/locations`,
        data
      );
      console.log('[ClientService] Location created:', response);
      return response.data;
    } catch (error: any) {
      console.error('[ClientService] Error creating location:', error);
      throw error;
    }
  }

  async updateLocation(data: UpdateLocationVM): Promise<LocationRM> {
    try {
      console.log('[ClientService] Updating location:', data);
      const response = await apiClient.put<LocationRM>(
        `${this.baseUrl}/locations/${data.id}`,
        data
      );
      console.log('[ClientService] Location updated:', response);
      return response.data;
    } catch (error: any) {
      console.error('[ClientService] Error updating location:', error);
      throw error;
    }
  }

  async deleteLocation(locationId: string): Promise<void> {
    try {
      console.log('[ClientService] Deleting location:', locationId);
      await apiClient.delete(`${this.baseUrl}/locations/${locationId}`);
      console.log('[ClientService] Location deleted');
    } catch (error: any) {
      console.error('[ClientService] Error deleting location:', error);
      throw error;
    }
  }

  async getClientLocations(clientId: string): Promise<LocationRM[]> {
    try {
      console.log('[ClientService] Getting locations for client:', clientId);
      const response = await apiClient.get<LocationRM[]>(
        `${this.baseUrl}/${clientId}/locations`
      );
      console.log('[ClientService] Locations retrieved:', response.data.length);
      return response.data;
    } catch (error: any) {
      console.error('[ClientService] Error getting locations:', error);
      throw error;
    }
  }

  // Helper method to search clients by name or email
  async searchClients(searchTerm: string): Promise<ClientListItem[]> {
    try {
      const response = await this.getClientList({
        searchTerm,
        pageSize: 50,
      });
      return response.items;
    } catch (error: any) {
      console.error('Error searching clients:', error);
      throw error;
    }
  }

  // Helper method to get client with all locations
  async getClientWithLocations(clientId: string): Promise<ClientRM> {
    try {
      const client = await this.getClientById(clientId);
      
      // TODO: If locations are managed separately, fetch them here
      // const locations = await this.getClientLocations(clientId);
      // client.locations = locations;
      
      return client;
    } catch (error: any) {
      console.error('Error fetching client with locations:', error);
      throw error;
    }
  }

  // Helper method to get client statistics
  async getClientStatistics(clientId: string): Promise<{
    totalEstimates: number;
    totalJobs: number;
    totalValue: number;
  }> {
    try {
      // TODO: Implement statistics endpoint or calculate from existing data
      // This would typically be a dedicated endpoint
      throw new Error('Client statistics endpoint not implemented');
    } catch (error: any) {
      console.error('Error fetching client statistics:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const clientService = new ClientService();
