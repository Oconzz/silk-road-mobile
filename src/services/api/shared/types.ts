// Type definitions and interfaces for API layer
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface PaginationParams {
  pageNumber?: number;
  pageSize?: number;
}

export interface SearchParams extends PaginationParams {
  searchTerm?: string;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

// Common API response wrapper
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
}

// Union type for all API responses
export type ApiResponseUnion<T> = SuccessResponse<T> | ErrorResponse;
