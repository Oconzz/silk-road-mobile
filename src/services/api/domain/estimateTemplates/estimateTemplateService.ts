import { apiClient } from '../../core/httpClient';
import type { EstimateTemplateRM, PagedResponse } from '../../../../types/apiResponses';

export interface EstimateTemplateListItem {
  id: string;
  companyId: string;
  name: string;
  description: string;
  total: number;
  itemCount: number;
  inventoryCount: number; // Alias for itemCount for backward compatibility
  createDatetime: string;
}

export interface CreateEstimateTemplateRequest {
  name: string;
  description?: string;
  items?: {
    description: string;
    quantity: number;
    cost: number;
    labor?: number;
    inventoryId?: string;
  }[];
}

export interface UpdateEstimateTemplateRequest {
  id: string;
  name?: string;
  description?: string;
  items?: {
    description: string;
    quantity: number;
    cost: number;
    labor?: number;
    inventoryId?: string;
  }[];
}

export interface EstimateTemplateListRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
}

export const estimateTemplateService = {
  /**
   * Get paginated list of estimate templates
   */
  list: async (request: EstimateTemplateListRequest = {}): Promise<PagedResponse<EstimateTemplateListItem>> => {
    const response = await apiClient.post('/EstimateTemplates/list', {
      pageNumber: request.pageNumber || 1,
      pageSize: request.pageSize || 50,
      searchTerm: request.searchTerm,
    });
    // Map itemCount to inventoryCount for backward compatibility
    const items = (response.data.items || []).map((item: any) => ({
      ...item,
      inventoryCount: item.inventoryCount ?? item.itemCount ?? 0,
    }));
    return { ...response.data, items };
  },

  /**
   * Get template by ID
   */
  getById: async (id: string): Promise<EstimateTemplateRM> => {
    const response = await apiClient.get(`/EstimateTemplates/${id}`);
    return response.data;
  },

  /**
   * Create a new template
   */
  create: async (request: CreateEstimateTemplateRequest): Promise<EstimateTemplateRM> => {
    const response = await apiClient.post('/EstimateTemplates/create', request);
    return response.data;
  },

  /**
   * Create template from existing estimate
   */
  createFromEstimate: async (estimateId: string, name: string, description?: string): Promise<EstimateTemplateRM> => {
    const response = await apiClient.post('/EstimateTemplates/createFromEstimate', {
      estimateId,
      name,
      description,
    });
    return response.data;
  },

  /**
   * Update template
   */
  update: async (request: UpdateEstimateTemplateRequest): Promise<EstimateTemplateRM> => {
    const response = await apiClient.put('/EstimateTemplates/update', request);
    return response.data;
  },

  /**
   * Delete template
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/EstimateTemplates/${id}`);
  },
};

export default estimateTemplateService;
