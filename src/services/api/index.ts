// Main export file for the API layer
// Re-export all services and utilities

// Core
export { apiClient, api } from './core/httpClient';
export { BaseApiService } from './core/baseService';

// Domain Services
export { authService } from './domain/auth/authService';
export { inventoryService } from './domain/inventory/inventoryService';
export { estimateService } from './domain/estimates/estimateService';
export { jobService, type JobStatus } from './domain/jobs/jobService';
export { clientService } from './domain/clients/clientService';
export { quickStartTemplateService } from './domain/quickStartTemplates/quickStartTemplateService';
export { companyService } from './domain/company/companyService';

// Shared utilities
export {
  StorageService,
  ValidationUtils,
  DateUtils,
  ErrorUtils,
  StorageKeys,
} from './shared/utils';

export type {
  ApiResponse,
  ApiError,
  PaginationParams,
  SearchParams,
  DateRangeParams,
  SuccessResponse,
  ErrorResponse,
  ApiResponseUnion,
} from './shared/types';

// Re-export types for convenience
export type {
  // Request types
  LoginVM,
  RegisterVM,
  CreateInventoryVM,
  UpdateInventoryVM,
  MoveInventoryVM,
  InventoryListRequestVM,
  CreateEstimateVM,
  UpdateEstimateVM,
  EstimateListRequestVM,
  ConvertEstimateToJobVM,
  CreateJobVM,
  UpdateJobVM,
  JobListRequestVM,
  CreateClientVM,
  UpdateClientVM,
  ClientListRequestVM,
} from '../../types/apiRequests';

// Import response types separately to avoid circular dependencies
export type {
  LoginRM as LoginResponseType,
  InventoryRM as InventoryResponseType,
  InventoryListItem as InventoryListItemType,
  EstimateRM as EstimateResponseType,
  EstimateListItem as EstimateListItemType,
  JobRM as JobResponseType,
  JobListItem as JobListItemType,
  ClientRM as ClientResponseType,
  ClientListItem as ClientListItemType,
  LocationRM as LocationResponseType,
  PagedResponse as PagedResponseType,
  CompanyAssignment as CompanyAssignmentType,
} from '../../types/apiResponses';
