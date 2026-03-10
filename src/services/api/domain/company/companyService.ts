import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import type { Company } from '../../../../types/company'; // We'll need to define generic Company type if not exists, or just use any for now

export interface UpdateCompanyVM {
    id?: string;
    name?: string;
    category?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    country?: string;
    logoUrl?: string;
}

export class CompanyService extends BaseApiService {
    protected readonly baseUrl = '/Company';

    /**
     * Get current company details
     */
    async getCompany(): Promise<any> {
        return this.handleRequest(
            async () => {
                const response = await api.get<any>(this.baseUrl);
                return response;
            },
            'Failed to fetch company details'
        );
    }

    /**
     * Update company details
     */
    async updateCompany(data: UpdateCompanyVM): Promise<any> {
        return this.handleRequest(
            async () => {
                const response = await api.put<any>(this.baseUrl, data);
                return response;
            },
            'Failed to update company details'
        );
    }
}

export const companyService = new CompanyService();
