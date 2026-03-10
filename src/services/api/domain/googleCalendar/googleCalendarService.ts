/**
 * Google Calendar Service (NMJ-40, NMJ-41, NMJ-42)
 * Handles Google Calendar integration for syncing jobs to user's calendar
 */

import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';

// Response types
export interface GoogleCalendarStatus {
  isLinked: boolean;
  linkedEmail?: string;
}

export interface GoogleCalendarAuthUrl {
  authorizationUrl: string;
}

export interface GoogleCalendarCallbackResult {
  success: boolean;
  linkedEmail?: string;
  syncedJobsCount?: number;
}

// Request types
export interface GoogleCalendarCallbackRequest {
  code: string;
  state?: string;
}

/**
 * Service for managing Google Calendar integration
 */
export class GoogleCalendarService extends BaseApiService {
  protected readonly baseUrl = '/api/GoogleCalendar';

  /**
   * Get the current user's Google Calendar connection status
   */
  async getStatus(): Promise<GoogleCalendarStatus> {
    return this.handleRequest(
      () => api.get<GoogleCalendarStatus>(`${this.baseUrl}/status`),
      'Failed to get calendar status'
    );
  }

  /**
   * Get the OAuth authorization URL to link Google Calendar
   */
  async getAuthUrl(): Promise<GoogleCalendarAuthUrl> {
    return this.handleRequest(
      () => api.get<GoogleCalendarAuthUrl>(`${this.baseUrl}/auth-url`),
      'Failed to get authorization URL'
    );
  }

  /**
   * Exchange authorization code for tokens after OAuth flow
   */
  async exchangeCode(code: string): Promise<GoogleCalendarCallbackResult> {
    return this.handleRequest(
      () => api.post<GoogleCalendarCallbackResult>(`${this.baseUrl}/callback`, { code }),
      'Failed to link Google Calendar'
    );
  }

  /**
   * Disconnect Google Calendar from the user's account
   */
  async disconnect(): Promise<void> {
    return this.handleRequest(
      () => api.post(`${this.baseUrl}/disconnect`),
      'Failed to disconnect Google Calendar'
    );
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();
