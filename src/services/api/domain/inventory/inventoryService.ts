// Inventory domain service
import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import { ErrorUtils } from '../../shared/utils';
import type {
  CreateInventoryVM,
  UpdateInventoryVM,
  MoveInventoryVM,
  InventoryListRequestVM,
} from '../../../../types/apiRequests';
import type {
  InventoryRM,
  InventoryListItem,
  PagedResponse,
} from '../../../../types/apiResponses';

export class InventoryService extends BaseApiService {
  protected readonly baseUrl = '/Inventory';

  async getInventoryList(
    request: InventoryListRequestVM = {}
  ): Promise<PagedResponse<InventoryListItem>> {
    return this.handleRequest(
      () => this.getAll<InventoryListItem>(request),
      'Failed to fetch inventory list'
    );
  }

  async getInventoryById(id: string): Promise<InventoryRM> {
    return this.handleRequest(
      () => this.getById<InventoryRM>(id),
      'Failed to fetch inventory item'
    );
  }

  async createInventory(data: CreateInventoryVM): Promise<InventoryRM> {
    return this.handleRequest(
      () => this.create<CreateInventoryVM, InventoryRM>(data),
      'Failed to create inventory item'
    );
  }

  async updateInventory(data: UpdateInventoryVM): Promise<InventoryRM> {
    return this.handleRequest(
      () => this.update<UpdateInventoryVM, InventoryRM>(data),
      'Failed to update inventory item'
    );
  }

  async deleteInventory(id: string): Promise<void> {
    return this.handleRequest(
      () => this.delete(id),
      'Failed to delete inventory item'
    );
  }

  async getAllocatedInventory(): Promise<{
    totalAllocatedItems: number;
    items: Array<{
      itemTitle: string;
      totalAllocated: number;
      jobs: Array<{
        jobId: string;
        jobTitle: string;
        jobNumber: string;
        jobStatus: string;
        allocatedQuantity: number;
      }>;
    }>;
  }> {
    return this.handleRequest(
      async () => {
        const response = await api.get(`${this.baseUrl}/allocated`);
        return response as any;
      },
      'Failed to fetch allocated inventory'
    );
  }

  async moveInventory(data: MoveInventoryVM): Promise<InventoryRM> {
    return this.handleRequest(
      async () => {
        const response = await api.post<InventoryRM>(
          `${this.baseUrl}/move`,
          data
        );
        return response;
      },
      'Failed to move inventory item'
    );
  }

  // Batch operations
  async createMultipleItems(
    items: CreateInventoryVM[]
  ): Promise<InventoryRM[]> {
    return this.handleRequest(
      async () => {
        const promises = items.map(item => this.createInventory(item));
        return await Promise.all(promises);
      },
      'Failed to create multiple inventory items'
    );
  }

  async updateMultipleItems(
    items: UpdateInventoryVM[]
  ): Promise<InventoryRM[]> {
    return this.handleRequest(
      async () => {
        const promises = items.map(item => this.updateInventory(item));
        return await Promise.all(promises);
      },
      'Failed to update multiple inventory items'
    );
  }

  async deleteMultipleItems(ids: string[]): Promise<void> {
    return this.handleRequest(
      async () => {
        const promises = ids.map(id => this.deleteInventory(id));
        await Promise.all(promises);
      },
      'Failed to delete multiple inventory items'
    );
  }

  // Search and filter methods
  async searchByBarcode(barcode: string): Promise<InventoryListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getInventoryList({
          searchTerm: barcode,
          pageSize: 50,
        });
        
        // Filter for exact barcode matches
        return response.items.filter(item => item.barcode === barcode);
      },
      'Failed to search by barcode'
    );
  }

  async searchByName(name: string): Promise<InventoryListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getInventoryList({
          searchTerm: name,
          pageSize: 50,
        });
        
        return response.items;
      },
      'Failed to search by name'
    );
  }

  async getLowStockItems(threshold: number = 10): Promise<InventoryListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getInventoryList({
          pageSize: 1000, // Get all items to check stock
        });
        
        return response.items.filter(item => item.totalQuantity <= threshold);
      },
      'Failed to fetch low stock items'
    );
  }

  async getItemsByWarehouse(warehouseId: string): Promise<InventoryListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getInventoryList({
          warehouseId,
          pageSize: 1000,
        });
        
        return response.items;
      },
      'Failed to fetch items by warehouse'
    );
  }

  // Statistics methods
  async getInventoryStats(): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    warehouseCount: number;
  }> {
    return this.handleRequest(
      async () => {
        const response = await this.getInventoryList({
          pageSize: 1000,
        });
        
        const totalItems = response.items.reduce((sum, item) => sum + item.totalQuantity, 0);
        const totalValue = response.items.reduce((sum, item) => sum + (item.price * item.totalQuantity), 0);
        const lowStockCount = response.items.filter(item => item.totalQuantity <= 10).length;
        const uniqueWarehouses = new Set(response.items.flatMap(item => 
          item.warehouseDetails.map(detail => detail.warehouseId)
        )).size;

        return {
          totalItems,
          totalValue,
          lowStockCount,
          warehouseCount: uniqueWarehouses,
        };
      },
      'Failed to fetch inventory statistics'
    );
  }

  // Inventory usage tracking
  async recordUsage(data: {
    inventoryId: string;
    jobId?: string;
    actionType: 'used' | 'returned';
    quantity: number;
    notes?: string;
  }): Promise<InventoryUsageHistoryRM> {
    return this.handleRequest(
      async () => {
        const response = await api.post<InventoryUsageHistoryRM>(
          `${this.baseUrl}/usage`,
          data
        );
        return response;
      },
      'Failed to record inventory usage'
    );
  }

  async getUsageHistory(inventoryId: string): Promise<InventoryUsageHistoryRM[]> {
    return this.handleRequest(
      async () => {
        const response = await api.get<InventoryUsageHistoryRM[]>(
          `${this.baseUrl}/${inventoryId}/history`
        );
        return response;
      },
      'Failed to fetch inventory usage history'
    );
  }

  // Add quantity to existing inventory item (creates new batch for FIFO tracking)
  async addQuantity(data: {
    inventoryId: string;
    quantity: number;
    returnDays?: number;
    notes?: string;
  }): Promise<InventoryRM> {
    return this.handleRequest(
      async () => {
        const response = await api.post<InventoryRM>(
          `${this.baseUrl}/add-quantity`,
          data
        );
        return response;
      },
      'Failed to add quantity to inventory item'
    );
  }

  async getStats(): Promise<InventoryStatsRM> {
    return this.handleRequest(
      async () => {
        const response = await api.get<InventoryStatsRM>(`${this.baseUrl}/stats`);
        return response;
      },
      'Failed to fetch inventory stats'
    );
  }
}

// Types for inventory stats
export interface InventoryStatsRM {
  totalValue: number;
  totalItems: number;
  amountSaved: number;
}

// Types for inventory usage history
export interface InventoryUsageHistoryRM {
  id: string;
  inventoryId: string;
  jobId?: string;
  jobTitle?: string;
  actionType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  notes?: string;
  performedByUserName?: string;
  createDatetime: string;
}

// Create singleton instance
export const inventoryService = new InventoryService();
