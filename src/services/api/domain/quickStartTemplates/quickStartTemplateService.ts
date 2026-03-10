// QuickStartTemplates domain service
import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import type { QuickStartTemplate } from '../../../../types/quickStartTemplate';
import type { EstimateRM } from '../../../../types/apiResponses';

export class QuickStartTemplateService extends BaseApiService {
    protected readonly baseUrl = '/QuickStartTemplates';

    /**
     * Get all templates for a specific category
     */
    async getTemplatesByCategory(category: string): Promise<QuickStartTemplate[]> {
        return this.handleRequest(
            async () => {
                const response = await api.get<QuickStartTemplate[]>(
                    `${this.baseUrl}/list?category=${encodeURIComponent(category)}`
                );
                return response;
            },
            'Failed to fetch quick start templates'
        );
    }

    /**
     * Copy a Quick Start Template to create a new draft estimate
     */
    async copyTemplateToDraft(templateId: string): Promise<EstimateRM> {
        return this.handleRequest(
            async () => {
                const response = await api.post<EstimateRM>(
                    `${this.baseUrl}/copy/${templateId}`,
                    {}
                );
                return response;
            },
            'Failed to copy template to draft'
        );
    }

    /**
     * Get a specific template by ID
     */
    async getTemplateById(id: string): Promise<QuickStartTemplate> {
        return this.handleRequest(
            async () => {
                const response = await api.get<QuickStartTemplate>(
                    `${this.baseUrl}/${id}`
                );
                return response;
            },
            'Failed to fetch template'
        );
    }
}

// Create singleton instance
export const quickStartTemplateService = new QuickStartTemplateService();
