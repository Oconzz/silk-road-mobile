import { apiClient } from '../../core/httpClient';
import type { CompanyConfig, UpdateCompanyConfigRequest, CreateCompanyConfigRequest } from '../../../../types/companyConfig';

class CompanyConfigService {
  async getCompanyConfig(): Promise<CompanyConfig> {
    const response = await apiClient.get<CompanyConfig>('/CompanyConfig');
    return response.data;
  }

  async createCompanyConfig(request: CreateCompanyConfigRequest): Promise<CompanyConfig> {
    const response = await apiClient.post<CompanyConfig>('/CompanyConfig/create', request);
    return response.data;
  }

  async updateCompanyConfig(request: UpdateCompanyConfigRequest): Promise<CompanyConfig> {
    const response = await apiClient.put<CompanyConfig>('/CompanyConfig/update', request);
    return response.data;
  }

  async deleteCompanyConfig(): Promise<void> {
    await apiClient.delete('/CompanyConfig');
  }
}

export const companyConfigService = new CompanyConfigService();
