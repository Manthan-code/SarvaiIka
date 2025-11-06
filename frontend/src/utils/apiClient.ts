/**
 * Standardized API Client
 * Provides consistent API calling patterns with unified error handling
 */

import { handleError, ErrorType, normalizeError } from './errorHandler';
import supabase from '../services/supabaseClient';

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
}

export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
  skipErrorHandling?: boolean;
  context?: string;
  signal?: AbortSignal;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;

  constructor(options: ApiClientOptions = {}) {
    // In development, prefer relative URLs to use Vite proxy (avoid CORS)
    const preferProxyInDev = (import.meta as any).env?.DEV && !(import.meta as any).env?.VITE_FORCE_ABSOLUTE_API_BASE_URL;
    this.baseURL = options.baseURL || (preferProxyInDev ? '' : (import.meta as any).env?.VITE_API_BASE_URL || '');
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 2;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Get authentication headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('❌ Auth session error:', error);
        return {};
      }
      
      if (!session) {
        return {};
      }
      
      if (!session.access_token) {
        console.warn('⚠️ No access token in session');
        return {};
      }
      
      return {
        'Authorization': `Bearer ${session.access_token}`
      };
    } catch (error) {
      console.warn('❌ Failed to get auth headers:', error);
      return {};
    }
  }

  /**
   * Build request headers
   */
  private async buildHeaders(options: RequestOptions = {}): Promise<Record<string, string>> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const authHeaders = options.skipAuth ? {} : await this.getAuthHeaders();
    
    return {
      ...defaultHeaders,
      ...authHeaders,
      ...options.headers
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    url: string,
    init: RequestInit,
    options: RequestOptions = {}
  ): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const headers = await this.buildHeaders(options);
    const timeout = options.timeout || this.timeout;
    const maxRetries = options.retries ?? this.retries;

    // Combine external signal with timeout signal
    let combinedSignal: AbortSignal;
    if (options.signal) {
      // If external signal is provided, combine it with timeout
      const timeoutSignal = AbortSignal.timeout(timeout);
      combinedSignal = AbortSignal.any([options.signal, timeoutSignal]);
    } else {
      // Use only timeout signal
      combinedSignal = AbortSignal.timeout(timeout);
    }

    const requestConfig: RequestInit = {
      ...init,
      headers,
      signal: combinedSignal
    };

    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(fullUrl, requestConfig);
        
        // Handle non-JSON responses (like HTML error pages)
        const contentType = response.headers.get('content-type');
        if (!response.ok) {
          let errorData: any = {};
          
          if (contentType?.includes('application/json')) {
            try {
              errorData = await response.json();
            } catch {
              // Failed to parse JSON error response
            }
          } else if (contentType?.includes('text/html')) {
            const htmlText = await response.text();
            // Preserve the actual HTTP status code instead of assuming 404
            const error = {
              message: `HTTP ${response.status}: ${response.statusText}`,
              code: this.getErrorCodeFromStatus(response.status),
              statusCode: response.status,
              details: { htmlResponse: htmlText }
            };
            throw error;
          }
          
          const error = {
            message: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            code: this.getErrorCodeFromStatus(response.status),
            statusCode: response.status,
            details: errorData
          };
          
          throw error;
        }
        
        // Parse successful response
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text() as T;
        }
        
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 408, 429
        if (error.statusCode >= 400 && error.statusCode < 500 && 
            error.statusCode !== 408 && error.statusCode !== 429) {
          break;
        }
        
        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
      }
    }
    
    // Handle the error
    if (!options.skipErrorHandling) {
      await handleError(lastError, {
        context: options.context || `API ${init.method || 'GET'} ${url}`,
        showNotification: true,
        logToConsole: true,
        reportToService: true
      });
    }
    
    throw lastError;
  }

  /**
   * Map HTTP status codes to error codes
   */
  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 400: return ErrorType.VALIDATION;
      case 401: return ErrorType.AUTHENTICATION;
      case 403: return ErrorType.AUTHORIZATION;
      case 404: return ErrorType.NOT_FOUND;
      case 408: case 429: return ErrorType.NETWORK;
      case 500: case 502: case 503: case 504: return ErrorType.SERVER;
      default: return status >= 400 && status < 500 ? ErrorType.CLIENT : ErrorType.SERVER;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(url, { method: 'GET' }, options);
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    }, options);
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    }, options);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    }, options);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.makeRequest<T>(url, { method: 'DELETE' }, options);
  }

  /**
   * Upload file
   */
  async upload<T = any>(url: string, file: File, options: RequestOptions = {}): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    const headers = await this.buildHeaders({ ...options, skipAuth: options.skipAuth });
    delete headers['Content-Type']; // Let browser set it for FormData
    
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: formData
    }, {
      ...options,
      headers
    });
  }
}

// Create default instance
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };

// Utility function for one-off requests
export const request = {
  get: <T = any>(url: string, options?: RequestOptions) => apiClient.get<T>(url, options),
  post: <T = any>(url: string, data?: any, options?: RequestOptions) => apiClient.post<T>(url, data, options),
  put: <T = any>(url: string, data?: any, options?: RequestOptions) => apiClient.put<T>(url, data, options),
  patch: <T = any>(url: string, data?: any, options?: RequestOptions) => apiClient.patch<T>(url, data, options),
  delete: <T = any>(url: string, options?: RequestOptions) => apiClient.delete<T>(url, options),
  upload: <T = any>(url: string, file: File, options?: RequestOptions) => apiClient.upload<T>(url, file, options)
};

export default apiClient;