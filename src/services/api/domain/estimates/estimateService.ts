// Estimates domain service
import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import { ErrorUtils } from '../../shared/utils';
import type {
  CreateEstimateVM,
  UpdateEstimateVM,
  EstimateListRequestVM,
  ConvertEstimateToJobVM,
  CreateEstimateItemVM,
  CreateEstimateMediaVM,
  UpdateEstimateMediaVM,
} from '../../../../types/apiRequests';
import type {
  EstimateRM,
  EstimateListItem,
  EstimateItemRM,
  PagedResponse,
  JobRM,
  EstimateMediaRM,
} from '../../../../types/apiResponses';

export class EstimateService extends BaseApiService {
  protected readonly baseUrl = '/Estimates';

  async getEstimateList(
    request: EstimateListRequestVM = {}
  ): Promise<PagedResponse<EstimateListItem>> {
    console.log('[EstimateService] Getting estimate list:', request);
    return this.handleRequest(
      () => this.getAll<EstimateListItem>(request),
      'Failed to fetch estimate list'
    );
  }

  async getEstimateById(id: string): Promise<EstimateRM> {
    return this.handleRequest(
      () => this.getById<EstimateRM>(id),
      'Failed to fetch estimate'
    );
  }

  async createEstimate(data: CreateEstimateVM): Promise<EstimateRM> {
    console.log('[EstimateService] Creating estimate:', data);
    return this.handleRequest(
      () => this.create<CreateEstimateVM, EstimateRM>(data),
      'Failed to create estimate'
    );
  }

  async updateEstimate(data: UpdateEstimateVM): Promise<EstimateRM> {
    if (!data.id) {
      throw new Error('Estimate ID is required for update');
    }
    return this.handleRequest(
      () => this.update<UpdateEstimateVM, EstimateRM>(data as UpdateEstimateVM & { id: string }),
      'Failed to update estimate'
    );
  }

  async deleteEstimate(id: string): Promise<void> {
    return this.handleRequest(
      () => this.delete(id),
      'Failed to delete estimate'
    );
  }

  async checkOverallocation(estimateId: string): Promise<{
    estimateId: string;
    hasConflicts: boolean;
    conflicts: Array<{
      itemTitle: string;
      requestedQuantity: number;
      availableQuantity: number;
      totalAlreadyAllocated: number;
      isOverallocated: boolean;
      conflictingJobs: Array<{
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
        const response = await api.get(
          `${this.baseUrl}/${estimateId}/check-overallocation`
        );
        return response as any;
      },
      'Failed to check overallocation'
    );
  }

  async convertToJob(data: ConvertEstimateToJobVM): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        const response = await api.post<JobRM>(
          `${this.baseUrl}/convert-to-job`,
          data
        );
        return response;
      },
      'Failed to convert estimate to job'
    );
  }

  // Line item operations
  async addLineItems(
    estimateId: string,
    items: CreateEstimateItemVM[]
  ): Promise<EstimateRM> {
    return this.handleRequest(
      async () => {
        // First get the current estimate
        const estimate = await this.getEstimateById(estimateId);

        // Add new items to existing items
        const updatedItems: CreateEstimateItemVM[] = [
          ...estimate.items.map(item => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            labor: item.labor,
            barcode: item.barcode,
            source: item.source,
          })),
          ...items,
        ];

        // Update the estimate
        return await this.updateEstimate({
          id: estimateId,
          items: updatedItems,
        });
      },
      'Failed to add line items'
    );
  }

  async updateLineItem(
    estimateId: string,
    itemId: string,
    updates: Partial<CreateEstimateItemVM>
  ): Promise<EstimateRM> {
    return this.handleRequest(
      async () => {
        const estimate = await this.getEstimateById(estimateId);

        const updatedItems = estimate.items.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        );

        return await this.updateEstimate({
          id: estimateId,
          items: updatedItems.map(item => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            labor: item.labor,
            barcode: item.barcode,
            source: item.source,
          })),
        });
      },
      'Failed to update line item'
    );
  }

  async removeLineItem(estimateId: string, itemId: string): Promise<EstimateRM> {
    return this.handleRequest(
      async () => {
        const estimate = await this.getEstimateById(estimateId);

        const updatedItems = estimate.items.filter(item => item.id !== itemId);

        return await this.updateEstimate({
          id: estimateId,
          items: updatedItems.map(item => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            labor: item.labor,
            barcode: item.barcode,
            source: item.source,
          })),
        });
      },
      'Failed to remove line item'
    );
  }

  // Media operations
  async addMedia(data: CreateEstimateMediaVM): Promise<EstimateMediaRM> {
    return this.handleRequest(
      () => api.post<EstimateMediaRM>('/EstimateMedia/create', data),
      'Failed to add media to estimate'
    );
  }

  async updateMedia(data: UpdateEstimateMediaVM): Promise<EstimateMediaRM> {
    return this.handleRequest(
      () => api.put<EstimateMediaRM>('/EstimateMedia/update', data),
      'Failed to update estimate media'
    );
  }

  async removeMedia(mediaId: string): Promise<void> {
    return this.handleRequest(
      () => api.delete(`/EstimateMedia/${mediaId}`),
      'Failed to remove media from estimate'
    );
  }

  // Status operations
  async sendToClient(estimateId: string): Promise<EstimateRM> {
    return this.handleRequest(
      () => this.updateEstimate({
        id: estimateId,
        sent: true,
      }),
      'Failed to send estimate to client'
    );
  }

  async markAsApproved(estimateId: string): Promise<EstimateRM> {
    return this.handleRequest(
      () => this.updateEstimate({
        id: estimateId,
        approved: true,
      }),
      'Failed to mark estimate as approved'
    );
  }

  async markAsRejected(estimateId: string): Promise<EstimateRM> {
    return this.handleRequest(
      () => this.updateEstimate({
        id: estimateId,
        approved: false,
      }),
      'Failed to mark estimate as rejected'
    );
  }

  // Template operations
  async saveAsTemplate(
    estimateId: string,
    templateName: string
  ): Promise<void> {
    return this.handleRequest(
      async () => {
        // TODO: Implement template saving endpoint
        // await api.post(`${this.baseUrl}/save-as-template`, {
        //   estimateId,
        //   name: templateName,
        // });
        throw new Error('Save as template not implemented');
      },
      'Failed to save estimate as template'
    );
  }

  async duplicateEstimate(
    estimateId: string,
    newName?: string
  ): Promise<EstimateRM> {
    return this.handleRequest(
      async () => {
        const original = await this.getEstimateById(estimateId);

        const duplicateData: CreateEstimateVM = {
          name: newName || `${original.name} (Copy)`,
          description: original.description,
          clientId: original.client?.id,
          locationId: original.location?.id,
          items: original.items.map(item => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            labor: item.labor,
            barcode: item.barcode,
            source: item.source,
          })),
          termsAndConditions: original.termsAndConditions,
        };

        return await this.createEstimate(duplicateData);
      },
      'Failed to duplicate estimate'
    );
  }

  // Search and filter
  async getEstimatesByClient(clientId: string): Promise<EstimateListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getEstimateList({
          clientId,
          pageSize: 100,
        });
        return response.items;
      },
      'Failed to fetch estimates by client'
    );
  }

  async getEstimatesByStatus(status: 'sent' | 'approved' | 'draft'): Promise<EstimateListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getEstimateList({
          sent: status === 'sent',
          approved: status === 'approved',
          pageSize: 100,
        });
        return response.items;
      },
      'Failed to fetch estimates by status'
    );
  }

  async searchEstimates(query: string): Promise<EstimateListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getEstimateList({
          searchTerm: query,
          pageSize: 50,
        });
        return response.items;
      },
      'Failed to search estimates'
    );
  }

  // Share link operations
  async generateShareLink(estimateId: string): Promise<EstimateRM> {
    console.log('[EstimateService] Generating share link for estimate:', estimateId);
    return this.handleRequest(
      () => api.post<EstimateRM>(`${this.baseUrl}/${estimateId}/generate-share-link`, {}),
      'Failed to generate share link'
    );
  }

  async getEstimateByShareId(shareId: string): Promise<EstimateRM> {
    console.log('[EstimateService] Getting estimate by share ID:', shareId);
    return this.handleRequest(
      () => api.get<EstimateRM>(`${this.baseUrl}/public/${shareId}`),
      'Failed to fetch shared estimate'
    );
  }

  // Analytics
  async getEstimateStats(dateRange?: {
    startDate: string;
    endDate: string;
  }): Promise<{
    totalEstimates: number;
    approvedCount: number;
    pendingCount: number;
    totalValue: number;
    conversionRate: number;
  }> {
    return this.handleRequest(
      async () => {
        const response = await this.getEstimateList({
          pageSize: 1000,
        });

        const estimates = response.items;
        const totalEstimates = estimates.length;
        const approvedCount = estimates.filter(e => e.approved).length;
        const pendingCount = estimates.filter(e => e.sent && !e.approved).length;
        const totalValue = estimates.reduce((sum, e) => sum + e.total, 0);
        const conversionRate = totalEstimates > 0 ? (approvedCount / totalEstimates) * 100 : 0;

        return {
          totalEstimates,
          approvedCount,
          pendingCount,
          totalValue,
          conversionRate,
        };
      },
      'Failed to fetch estimate statistics'
    );
  }
  // Versioning operations
  async createVersion(estimateId: string): Promise<EstimateRM> {
    return this.handleRequest(
      async () => {
        const response = await api.post<EstimateRM>(
          `${this.baseUrl}/${estimateId}/create-version`
        );
        return response;
      },
      'Failed to create new estimate version'
    );
  }

  async getVersionHistory(estimateId: string): Promise<EstimateListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await api.get(
          `${this.baseUrl}/${estimateId}/versions`
        );
        return response as any;
      },
      'Failed to fetch estimate version history'
    );
  }
}

// Create singleton instance
export const estimateService = new EstimateService();
