import api from './api';
import type {
  Estimate,
  EstimateListItem,
  CreateEstimateRequest,
  UpdateEstimateRequest,
  EstimateListRequest,
  ConvertEstimateToJobRequest,
  EstimateTemplate,
  EstimateTemplateListItem,
  CreateEstimateTemplateRequest,
  UpdateEstimateTemplateRequest,
  EstimateTemplateListRequest,
  Client,
  ClientListItem,
  CreateClientRequest,
  UpdateClientRequest,
  ClientListRequest,
  Location,
  LocationListItem,
  CreateLocationRequest,
  Job,
  PagedResponse,
} from '../types/estimate';

// Get company ID from storage/context - placeholder for now
const getCompanyId = (): string => {
  // TODO: Get from auth context
  return 'default-company-id';
};

const getHeaders = () => ({
  'X-Company-Id': getCompanyId(),
});

// ===== Estimates API =====
export const estimateApi = {
  // List estimates with pagination and filters
  list: async (request: EstimateListRequest = {}): Promise<PagedResponse<EstimateListItem>> => {
    try {
      const response = await api.post('/Estimates/list', {
        pageNumber: request.pageNumber || 1,
        pageSize: request.pageSize || 20,
        searchTerm: request.searchTerm,
        sent: request.sent,
        approved: request.approved,
        clientId: request.clientId,
      }, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateAPI] Error listing estimates:', error);
      throw error;
    }
  },

  // Get estimate by ID
  getById: async (id: string): Promise<Estimate> => {
    try {
      const response = await api.get(`/Estimates/${id}`, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateAPI] Error getting estimate:', error);
      throw error;
    }
  },

  // Create new estimate
  create: async (request: CreateEstimateRequest): Promise<Estimate> => {
    try {
      const response = await api.post('/Estimates/create', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateAPI] Error creating estimate:', error);
      throw error;
    }
  },

  // Update estimate
  update: async (request: UpdateEstimateRequest): Promise<Estimate> => {
    try {
      const response = await api.put('/Estimates/update', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateAPI] Error updating estimate:', error);
      throw error;
    }
  },

  // Delete estimate
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/Estimates/${id}`, { headers: getHeaders() });
    } catch (error) {
      console.error('[EstimateAPI] Error deleting estimate:', error);
      throw error;
    }
  },

  // Convert estimate to job
  convertToJob: async (request: ConvertEstimateToJobRequest): Promise<Job> => {
    try {
      const response = await api.post('/Estimates/convert-to-job', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateAPI] Error converting estimate to job:', error);
      throw error;
    }
  },
};

// ===== Estimate Templates API =====
export const estimateTemplateApi = {
  // List templates
  list: async (request: EstimateTemplateListRequest = {}): Promise<PagedResponse<EstimateTemplateListItem>> => {
    try {
      const response = await api.post('/EstimateTemplates/list', {
        pageNumber: request.pageNumber || 1,
        pageSize: request.pageSize || 20,
        searchTerm: request.searchTerm,
      }, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateTemplateAPI] Error listing templates:', error);
      throw error;
    }
  },

  // Get template by ID
  getById: async (id: string): Promise<EstimateTemplate> => {
    try {
      const response = await api.get(`/EstimateTemplates/${id}`, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateTemplateAPI] Error getting template:', error);
      throw error;
    }
  },

  // Create template
  create: async (request: CreateEstimateTemplateRequest): Promise<EstimateTemplate> => {
    try {
      const response = await api.post('/EstimateTemplates/create', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateTemplateAPI] Error creating template:', error);
      throw error;
    }
  },

  // Update template
  update: async (request: UpdateEstimateTemplateRequest): Promise<EstimateTemplate> => {
    try {
      const response = await api.put('/EstimateTemplates/update', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[EstimateTemplateAPI] Error updating template:', error);
      throw error;
    }
  },

  // Delete template
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/EstimateTemplates/${id}`, { headers: getHeaders() });
    } catch (error) {
      console.error('[EstimateTemplateAPI] Error deleting template:', error);
      throw error;
    }
  },
};

// ===== Clients API =====
export const clientApi = {
  // List clients
  list: async (request: ClientListRequest = {}): Promise<PagedResponse<ClientListItem>> => {
    try {
      const response = await api.post('/Clients/list', {
        pageNumber: request.pageNumber || 1,
        pageSize: request.pageSize || 20,
        searchTerm: request.searchTerm,
      }, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[ClientAPI] Error listing clients:', error);
      throw error;
    }
  },

  // Get client by ID
  getById: async (id: string): Promise<Client> => {
    try {
      const response = await api.get(`/Clients/${id}`, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[ClientAPI] Error getting client:', error);
      throw error;
    }
  },

  // Create client
  create: async (request: CreateClientRequest): Promise<Client> => {
    try {
      const response = await api.post('/Clients/create', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[ClientAPI] Error creating client:', error);
      throw error;
    }
  },

  // Update client
  update: async (request: UpdateClientRequest): Promise<Client> => {
    try {
      const response = await api.put('/Clients/update', request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[ClientAPI] Error updating client:', error);
      throw error;
    }
  },

  // Delete client
  delete: async (id: string): Promise<void> => {
    try {
      await api.delete(`/Clients/${id}`, { headers: getHeaders() });
    } catch (error) {
      console.error('[ClientAPI] Error deleting client:', error);
      throw error;
    }
  },

  // Get locations for a client
  getLocations: async (clientId: string): Promise<LocationListItem[]> => {
    try {
      const response = await api.get(`/Clients/${clientId}/locations`, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[ClientAPI] Error getting client locations:', error);
      throw error;
    }
  },
};

// ===== Locations API =====
export const locationApi = {
  // Get location by ID
  getById: async (id: string): Promise<Location> => {
    try {
      const response = await api.get(`/Locations/${id}`, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[LocationAPI] Error getting location:', error);
      throw error;
    }
  },

  // Create location for client
  create: async (clientId: string, request: CreateLocationRequest): Promise<Location> => {
    try {
      const response = await api.post(`/Clients/${clientId}/locations`, request, { headers: getHeaders() });
      return response.data;
    } catch (error) {
      console.error('[LocationAPI] Error creating location:', error);
      throw error;
    }
  },
};
