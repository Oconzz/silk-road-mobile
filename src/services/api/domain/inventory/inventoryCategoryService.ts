import { apiClient } from '../../core/httpClient';

export interface InventoryCategoryRM {
  id: string;
  name: string;
  color: string;
}

interface CreateCategoryRequest {
  name: string;
  color?: string;
}

class InventoryCategoryService {
  async getCategories(): Promise<InventoryCategoryRM[]> {
    const response = await apiClient.get<InventoryCategoryRM[]>('/api/InventoryCategory');
    return response.data;
  }

  async createCategory(request: CreateCategoryRequest): Promise<InventoryCategoryRM> {
    const response = await apiClient.post<InventoryCategoryRM>('/api/InventoryCategory', {
      name: request.name,
      color: request.color,
    });
    return response.data;
  }

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/api/InventoryCategory/${id}`);
  }
}

export const inventoryCategoryService = new InventoryCategoryService();
