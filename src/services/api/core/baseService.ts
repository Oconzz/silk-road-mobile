// Base API service class with common functionality
import { api } from './httpClient';
import type { PagedResponse } from '../../../types/apiResponses';

export abstract class BaseApiService {
  protected abstract readonly baseUrl: string;

  // Generic get all with pagination
  protected async getAll<T>(
    request: { pageNumber?: number; pageSize?: number; [key: string]: any } = {}
  ): Promise<PagedResponse<T>> {
    return api.post<PagedResponse<T>>(`${this.baseUrl}/list`, request);
  }

  // Generic get by id
  protected async getById<T>(id: string): Promise<T> {
    return api.get<T>(`${this.baseUrl}/${id}`);
  }

  // Generic create
  protected async create<T, R = T>(data: T): Promise<R> {
    return api.post<R>(`${this.baseUrl}/create`, data);
  }

  // Generic update
  protected async update<T, R = T>(data: T & { id: string }): Promise<R> {
    return api.put<R>(`${this.baseUrl}/update`, data);
  }

  // Generic delete
  protected async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Helper to build query params from object
  protected buildQueryParams(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  // Error handling wrapper
  protected async handleRequest<T>(
    request: () => Promise<T>,
    errorMessage: string = 'Request failed'
  ): Promise<T> {
    try {
      return await request();
    } catch (error: any) {
      console.error(errorMessage, error);
      throw new Error(error.response?.data?.message || error.message || errorMessage);
    }
  }
}
