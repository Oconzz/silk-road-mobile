// Clients domain service
import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import { ErrorUtils } from '../../shared/utils';
import type {
  CreateClientVM,
  UpdateClientVM,
  ClientListRequestVM,
  CreateLocationVM,
  UpdateLocationVM,
  BulkCreateClientVM,
} from '../../../../types/apiRequests';
import type {
  ClientRM,
  ClientListItem,
  LocationRM,
  PagedResponse,
  BulkCreateClientResultRM,
} from '../../../../types/apiResponses';

export class ClientService extends BaseApiService {
  protected readonly baseUrl = '/Client';

  async getClientList(
    request: ClientListRequestVM = {}
  ): Promise<PagedResponse<ClientListItem>> {
    console.log('[ClientService] Getting client list:', request);
    return this.handleRequest(
      () => this.getAll<ClientListItem>(request),
      'Failed to fetch client list'
    );
  }

  async getClientById(id: string): Promise<ClientRM> {
    return this.handleRequest(
      () => this.getById<ClientRM>(id),
      'Failed to fetch client'
    );
  }

  async createClient(data: CreateClientVM): Promise<ClientRM> {
    console.log('[ClientService] Creating client:', data);
    return this.handleRequest(
      () => this.create<CreateClientVM, ClientRM>(data),
      'Failed to create client'
    );
  }

  async bulkCreateClients(data: BulkCreateClientVM): Promise<BulkCreateClientResultRM> {
    console.log('[ClientService] Bulk creating clients:', data.clients.length);
    return this.handleRequest(
      async () => {
        // api.post already returns response.data, so we return directly
        const result = await api.post<BulkCreateClientResultRM>(
          `${this.baseUrl}/bulk`,
          data
        );
        console.log('[ClientService] Bulk create result:', result);
        return result;
      },
      'Failed to bulk create clients'
    );
  }

  async updateClient(data: UpdateClientVM): Promise<ClientRM> {
    return this.handleRequest(
      () => this.update<UpdateClientVM, ClientRM>(data),
      'Failed to update client'
    );
  }

  async deleteClient(id: string): Promise<void> {
    return this.handleRequest(
      () => this.delete(id),
      'Failed to delete client'
    );
  }

  // Location management
  async createLocation(clientId: string, data: CreateLocationVM): Promise<LocationRM> {
    return this.handleRequest(
      async () => {
        const response = await api.post<LocationRM>(
          `${this.baseUrl}/${clientId}/locations`,
          data
        );
        return response;
      },
      'Failed to create location'
    );
  }

  async updateLocation(data: UpdateLocationVM): Promise<LocationRM> {
    return this.handleRequest(
      async () => {
        const response = await api.put<LocationRM>(
          `${this.baseUrl}/locations/${data.id}`,
          data
        );
        return response;
      },
      'Failed to update location'
    );
  }

  async deleteLocation(locationId: string): Promise<void> {
    return this.handleRequest(
      async () => {
        await api.delete(`${this.baseUrl}/locations/${locationId}`);
      },
      'Failed to delete location'
    );
  }

  async getClientLocations(clientId: string): Promise<LocationRM[]> {
    return this.handleRequest(
      async () => {
        const response = await api.get<LocationRM[]>(
          `${this.baseUrl}/${clientId}/locations`
        );
        return response;
      },
      'Failed to get client locations'
    );
  }

  // Search and filter methods
  async searchClients(searchTerm: string): Promise<ClientListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getClientList({
          searchTerm,
          pageSize: 50,
        });
        return response.items;
      },
      'Failed to search clients'
    );
  }

  async getClientsByName(name: string): Promise<ClientListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getClientList({
          searchTerm: name,
          pageSize: 50,
        });
        return response.items.filter(client =>
          client.contactName.toLowerCase().includes(name.toLowerCase())
        );
      },
      'Failed to fetch clients by name'
    );
  }

  async getClientsByEmail(email: string): Promise<ClientListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getClientList({
          searchTerm: email,
          pageSize: 50,
        });
        return response.items.filter(client =>
          client.email.toLowerCase().includes(email.toLowerCase())
        );
      },
      'Failed to fetch clients by email'
    );
  }

  async getActiveClients(): Promise<ClientListItem[]> {
    return this.handleRequest(
      async () => {
        // TODO: Implement active filter when available
        const response = await this.getClientList({
          pageSize: 100,
        });
        return response.items;
      },
      'Failed to fetch active clients'
    );
  }

  async getRecentClients(days: number = 30): Promise<ClientListItem[]> {
    return this.handleRequest(
      async () => {
        // TODO: Implement date filtering when available
        const response = await this.getClientList({
          pageSize: 50,
        });
        return response.items;
      },
      'Failed to fetch recent clients'
    );
  }

  // Client analytics
  async getClientStats(clientId: string): Promise<{
    totalEstimates: number;
    totalJobs: number;
    totalValue: number;
    lastActivity?: string;
  }> {
    return this.handleRequest(
      async () => {
        // TODO: Implement statistics endpoint or calculate from existing data
        // This would typically be a dedicated endpoint
        throw new Error('Client statistics endpoint not implemented');
      },
      'Failed to fetch client statistics'
    );
  }

  async getAllClientsStats(): Promise<{
    totalClients: number;
    activeClients: number;
    newClientsThisMonth: number;
    totalValue: number;
  }> {
    return this.handleRequest(
      async () => {
        const response = await this.getClientList({
          pageSize: 1000,
        });
        
        const clients = response.items;
        const totalClients = clients.length;
        
        // TODO: Implement proper active/new logic when dates are available
        const activeClients = totalClients;
        const newClientsThisMonth = 0;
        const totalValue = 0; // Would come from estimates/jobs

        return {
          totalClients,
          activeClients,
          newClientsThisMonth,
          totalValue,
        };
      },
      'Failed to fetch client statistics'
    );
  }

  // Client communication
  async sendEmailToClient(
    clientId: string,
    subject: string,
    message: string
  ): Promise<void> {
    return this.handleRequest(
      async () => {
        // TODO: Implement email sending endpoint
        throw new Error('Email sending not implemented');
      },
      'Failed to send email to client'
    );
  }

  async getClientHistory(clientId: string): Promise<{
    estimates: any[];
    jobs: any[];
    invoices: any[];
  }> {
    return this.handleRequest(
      async () => {
        // TODO: Implement client history endpoint
        throw new Error('Client history endpoint not implemented');
      },
      'Failed to fetch client history'
    );
  }

  // Import/Export
  async importClients(file: File): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    return this.handleRequest(
      async () => {
        // TODO: Implement client import endpoint
        throw new Error('Client import not implemented');
      },
      'Failed to import clients'
    );
  }

  async exportClients(format: 'csv' | 'excel' = 'csv'): Promise<Blob> {
    return this.handleRequest(
      async () => {
        // TODO: Implement client export endpoint
        throw new Error('Client export not implemented');
      },
      'Failed to export clients'
    );
  }

  // Helper methods
  static formatClientName(client: ClientListItem | ClientRM): string {
    if ('companyName' in client && client.companyName) {
      return client.companyName;
    }
    return client.contactName;
  }

  static getClientDisplayName(client: ClientListItem | ClientRM): string {
    const name = this.formatClientName(client);
    const company = 'companyName' in client ? client.companyName : null;
    
    if (company && company !== name) {
      return `${name} (${company})`;
    }
    
    return name;
  }

  static getClientInitials(client: ClientListItem | ClientRM): string {
    const name = this.formatClientName(client);
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}

// Create singleton instance
export const clientService = new ClientService();
