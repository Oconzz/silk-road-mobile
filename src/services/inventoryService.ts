import { apiClient } from './api/core/httpClient';
import type {
  CreateInventoryVM,
  UpdateInventoryVM,
  MoveInventoryVM,
  InventoryListRequestVM,
} from '../types/apiRequests';
import type {
  InventoryRM,
  InventoryListItem,
  PagedResponse,
} from '../types/apiResponses';

export class InventoryService {
  private readonly baseUrl = '/Inventory';

  async getInventoryList(
    request: InventoryListRequestVM = {}
  ): Promise<PagedResponse<InventoryListItem>> {
    try {
      const response = await apiClient.post<PagedResponse<InventoryListItem>>(
        `${this.baseUrl}/list`,
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching inventory list:', error);
      throw error;
    }
  }

  async getInventoryById(id: string): Promise<InventoryRM> {
    try {
      const response = await apiClient.get<InventoryRM>(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      throw error;
    }
  }

  async createInventory(data: CreateInventoryVM): Promise<InventoryRM> {
    try {
      const response = await apiClient.post<InventoryRM>(
        `${this.baseUrl}/create`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error creating inventory:', error);
      throw error;
    }
  }

  async updateInventory(data: UpdateInventoryVM): Promise<InventoryRM> {
    try {
      const response = await apiClient.put<InventoryRM>(
        `${this.baseUrl}/update`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  }

  async deleteInventory(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`);
    } catch (error: any) {
      console.error('Error deleting inventory:', error);
      throw error;
    }
  }

  async moveInventory(data: MoveInventoryVM): Promise<InventoryRM> {
    try {
      const response = await apiClient.post<InventoryRM>(
        `${this.baseUrl}/move`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error moving inventory:', error);
      throw error;
    }
  }

  // Helper method to create multiple items at once
  async createMultipleItems(
    items: CreateInventoryVM[]
  ): Promise<InventoryRM[]> {
    try {
      const promises = items.map(item => this.createInventory(item));
      return await Promise.all(promises);
    } catch (error: any) {
      console.error('Error creating multiple inventory items:', error);
      throw error;
    }
  }

  // Helper method to search items by barcode
  async searchByBarcode(barcode: string): Promise<InventoryListItem[]> {
    try {
      const response = await this.getInventoryList({
        searchTerm: barcode,
        pageSize: 50,
      });
      
      // Filter for exact barcode matches
      return response.items.filter((item: any) => item.barcode === barcode);
    } catch (error: any) {
      console.error('Error searching by barcode:', error);
      throw error;
    }
  }

  // Add quantity to existing inventory item (creates new batch for FIFO tracking)
  async addQuantity(data: {
    inventoryId: string;
    quantity: number;
    returnDays?: number;
    notes?: string;
  }): Promise<InventoryRM> {
    try {
      const response = await apiClient.post<InventoryRM>(
        `${this.baseUrl}/add-quantity`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error adding quantity to inventory:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const inventoryService = new InventoryService();
