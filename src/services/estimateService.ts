import { apiClient } from './api/core/httpClient';
import type {
  CreateEstimateVM,
  UpdateEstimateVM,
  EstimateListRequestVM,
  ConvertEstimateToJobVM,
  CreateEstimateItemVM,
} from '../types/apiRequests';
import type {
  EstimateRM,
  EstimateListItem,
  EstimateItemRM,
  PagedResponse,
  JobRM,
} from '../types/apiResponses';

export class EstimateService {
  private readonly baseUrl = '/Estimates';

  async getEstimateList(
    request: EstimateListRequestVM = {}
  ): Promise<PagedResponse<EstimateListItem>> {
    try {
      const response = await apiClient.post<PagedResponse<EstimateListItem>>(
        `${this.baseUrl}/list`,
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching estimate list:', error);
      throw error;
    }
  }

  async getEstimateById(id: string): Promise<EstimateRM> {
    try {
      const response = await apiClient.get<EstimateRM>(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching estimate:', error);
      throw error;
    }
  }

  async createEstimate(data: CreateEstimateVM): Promise<EstimateRM> {
    try {
      const response = await apiClient.post<EstimateRM>(
        `${this.baseUrl}/create`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error creating estimate:', error);
      throw error;
    }
  }

  async updateEstimate(data: UpdateEstimateVM): Promise<EstimateRM> {
    try {
      const response = await apiClient.put<EstimateRM>(
        `${this.baseUrl}/update`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating estimate:', error);
      throw error;
    }
  }

  async deleteEstimate(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`);
    } catch (error: any) {
      console.error('Error deleting estimate:', error);
      throw error;
    }
  }

  async convertToJob(data: ConvertEstimateToJobVM): Promise<JobRM> {
    try {
      const response = await apiClient.post<JobRM>(
        `${this.baseUrl}/convert-to-job`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error converting estimate to job:', error);
      throw error;
    }
  }

  // Helper method to add line items to an estimate
  async addLineItems(
    estimateId: string,
    items: CreateEstimateItemVM[]
  ): Promise<EstimateRM> {
    try {
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
    } catch (error: any) {
      console.error('Error adding line items:', error);
      throw error;
    }
  }

  // Helper method to send estimate to client
  async sendToClient(estimateId: string): Promise<EstimateRM> {
    try {
      return await this.updateEstimate({
        id: estimateId,
        sent: true,
      });
    } catch (error: any) {
      console.error('Error sending estimate to client:', error);
      throw error;
    }
  }

  // Helper method to mark estimate as approved
  async markAsApproved(estimateId: string): Promise<EstimateRM> {
    try {
      return await this.updateEstimate({
        id: estimateId,
        approved: true,
      });
    } catch (error: any) {
      console.error('Error marking estimate as approved:', error);
      throw error;
    }
  }

  // Helper method to duplicate an estimate
  async duplicateEstimate(
    estimateId: string,
    newName?: string
  ): Promise<EstimateRM> {
    try {
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
    } catch (error: any) {
      console.error('Error duplicating estimate:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const estimateService = new EstimateService();
