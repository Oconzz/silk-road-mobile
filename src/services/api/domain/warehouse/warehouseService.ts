// Warehouse domain service
import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import type {
  CreateWarehouseVM,
  UpdateWarehouseVM,
} from '../../../../types/apiRequests';
import type {
  WarehouseRM,
  WarehouseListItem,
  PagedResponse,
} from '../../../../types/apiResponses';

export class WarehouseService extends BaseApiService {
  protected readonly baseUrl = '/Warehouse';

  // Singleton promise to prevent race condition when multiple contexts
  // call getOrCreateDefaultWarehouse simultaneously during app init
  private _defaultWarehousePromise: Promise<WarehouseRM> | null = null;

  async getWarehouseList(
    request: { pageNumber?: number; pageSize?: number } = {}
  ): Promise<PagedResponse<WarehouseListItem>> {
    console.log('[WarehouseService] Getting warehouse list');
    return this.handleRequest(
      () => this.getAll<WarehouseListItem>(request),
      'Failed to fetch warehouse list'
    );
  }

  async getWarehouseById(id: string): Promise<WarehouseRM> {
    console.log('[WarehouseService] Getting warehouse by id:', id);
    return this.handleRequest(
      () => this.getById<WarehouseRM>(id),
      'Failed to fetch warehouse'
    );
  }

  async createWarehouse(data: CreateWarehouseVM): Promise<WarehouseRM> {
    console.log('[WarehouseService] Creating warehouse:', data);
    return this.handleRequest(
      () => this.create<CreateWarehouseVM, WarehouseRM>(data),
      'Failed to create warehouse'
    );
  }

  async updateWarehouse(data: UpdateWarehouseVM): Promise<WarehouseRM> {
    console.log('[WarehouseService] Updating warehouse:', data);
    return this.handleRequest(
      () => this.update<UpdateWarehouseVM, WarehouseRM>(data),
      'Failed to update warehouse'
    );
  }

  async deleteWarehouse(id: string): Promise<void> {
    console.log('[WarehouseService] Deleting warehouse:', id);
    return this.handleRequest(
      () => this.delete(id),
      'Failed to delete warehouse'
    );
  }

  async getOrCreateDefaultWarehouse(): Promise<WarehouseRM> {
    // Use singleton promise to prevent duplicate warehouse creation
    // when multiple contexts call this method simultaneously
    if (this._defaultWarehousePromise) {
      console.log('[WarehouseService] Reusing in-flight default warehouse request');
      return this._defaultWarehousePromise;
    }

    this._defaultWarehousePromise = this._doGetOrCreateDefaultWarehouse();

    try {
      const result = await this._defaultWarehousePromise;
      return result;
    } finally {
      this._defaultWarehousePromise = null;
    }
  }

  private async _doGetOrCreateDefaultWarehouse(): Promise<WarehouseRM> {
    console.log('[WarehouseService] Getting or creating default warehouse');
    try {
      // Try to get existing warehouses
      const response = await this.getWarehouseList({ pageSize: 100 });
      
      if (response.items && response.items.length > 0) {
        console.log('[WarehouseService] Found existing warehouse:', response.items[0].id);
        // Get full warehouse details
        return await this.getWarehouseById(response.items[0].id);
      }

      // Create default warehouse if none exists
      console.log('[WarehouseService] No warehouse found, creating default');
      const newWarehouse = await this.createWarehouse({
        name: 'Main Warehouse',
        location: 'Default Location',
      });
      
      console.log('[WarehouseService] Created default warehouse:', newWarehouse.id);
      return newWarehouse;
    } catch (error) {
      console.error('[WarehouseService] Error getting/creating default warehouse:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const warehouseService = new WarehouseService();
