import { getConfig } from './config';
import * as Types from './types';

class APIClient {
  private getHeaders(includeUserId: boolean = true) {
    const { apiKey, userId } = getConfig();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Check if we have a JWT token stored
    const jwtToken = typeof window !== 'undefined' ? localStorage.getItem('buzz_jwt_token') : null;
    const activeAppId = typeof window !== 'undefined' ? localStorage.getItem('buzz_active_app_id') : null;

    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
      if (activeAppId) {
        headers['X-Application-ID'] = activeAppId;
      }
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (includeUserId) {
      headers['X-User-ID'] = userId;
    }
    return headers;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { noUserID?: boolean } = {}
  ): Promise<T> {
    const { apiUrl } = getConfig();
    const headers = this.getHeaders(!options.noUserID);

    const url = new URL(path, apiUrl).toString();
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API Error ${response.status}: ${text || response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return response as unknown as T;
  }

  // Health
  async getHealth(): Promise<Types.HealthResponse> {
    return this.request<Types.HealthResponse>('/health', { noUserID: true });
  }

  // Notifications
  async sendNotification(req: Types.SendNotificationRequest): Promise<Types.Notification> {
    return this.request<Types.Notification>('/api/v1/notifications', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async listNotifications(params?: {
    status?: string;
    channel?: string;
    recipient_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Types.PaginatedResponse<Types.Notification>> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.channel) query.append('channel', params.channel);
    if (params?.recipient_id) query.append('recipient_id', params.recipient_id);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    return this.request<Types.PaginatedResponse<Types.Notification>>(
      `/api/v1/notifications?${query.toString()}`
    );
  }

  async getNotification(id: string): Promise<Types.Notification> {
    return this.request<Types.Notification>(`/api/v1/notifications/${id}`);
  }

  // Templates
  async createTemplate(req: Types.CreateTemplateRequest): Promise<Types.Template> {
    return this.request<Types.Template>('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async listTemplates(params?: {
    channel?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Types.PaginatedResponse<Types.Template>> {
    const query = new URLSearchParams();
    if (params?.channel) query.append('channel', params.channel);
    if (params?.active !== undefined) query.append('active', params.active.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    return this.request<Types.PaginatedResponse<Types.Template>>(
      `/api/v1/templates?${query.toString()}`
    );
  }

  async getTemplate(name: string): Promise<Types.Template> {
    return this.request<Types.Template>(`/api/v1/templates/${encodeURIComponent(name)}`);
  }

  async updateTemplate(name: string, req: Types.UpdateTemplateRequest): Promise<Types.Template> {
    return this.request<Types.Template>(`/api/v1/templates/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  }

  async deleteTemplate(name: string): Promise<Types.MessageResponse> {
    return this.request<Types.MessageResponse>(
      `/api/v1/templates/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
  }

  // Devices
  async registerDevice(req: Types.RegisterDeviceRequest): Promise<{ message: string; id: string }> {
    return this.request<{ message: string; id: string }>('/api/v1/devices/register', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async listDevices(userId: string): Promise<{ user_id: string; devices: Types.DeviceToken[]; count: number }> {
    const query = new URLSearchParams({ user_id: userId });
    return this.request<{ user_id: string; devices: Types.DeviceToken[]; count: number }>(
      `/api/v1/devices?${query.toString()}`
    );
  }

  async unregisterDevice(token: string): Promise<Types.MessageResponse> {
    return this.request<Types.MessageResponse>(`/api/v1/devices/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
  }

  // Inbox
  async getInbox(params?: {
    unread?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Types.InboxEntry[]; total: number; unread_count: number; limit: number; offset: number }> {
    const query = new URLSearchParams();
    if (params?.unread !== undefined) query.append('unread', params.unread.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    return this.request<{ data: Types.InboxEntry[]; total: number; unread_count: number; limit: number; offset: number }>(
      `/api/v1/inbox?${query.toString()}`
    );
  }

  async markAsRead(id: string): Promise<Types.MessageResponse> {
    return this.request<Types.MessageResponse>(`/api/v1/inbox/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllAsRead(): Promise<Types.MessageResponse> {
    return this.request<Types.MessageResponse>('/api/v1/inbox/read-all', {
      method: 'POST',
    });
  }

  async deleteInboxEntry(id: string): Promise<Types.MessageResponse> {
    return this.request<Types.MessageResponse>(`/api/v1/inbox/${id}`, {
      method: 'DELETE',
    });
  }

  // Batches
  async sendBulk(req: Types.SendBulkRequest): Promise<{ batch_id: string; status: string; message: string }> {
    return this.request<{ batch_id: string; status: string; message: string }>('/api/v1/batches/send', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async getBatchStatus(id: string): Promise<Types.Batch> {
    return this.request<Types.Batch>(`/api/v1/batches/${id}`);
  }

  async cancelBatch(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/batches/${id}/cancel`, { method: 'POST' });
  }

  async deleteBatch(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/batches/${id}`, { method: 'DELETE' });
  }

  async listBatches(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ batches: Types.Batch[]; total: number; limit: number; offset: number }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    return this.request<{ batches: Types.Batch[]; total: number; limit: number; offset: number }>(
      `/api/v1/batches?${query.toString()}`
    );
  }

  // Online user stats from SSE gateway
  async getOnlineStats(): Promise<{ online_users: number; total_connections: number }> {
    return this.request('/api/v1/stream/stats');
  }

  // Datasource CRUD
  async listDatasources(): Promise<{ data: Types.Datasource[]; total: number }> {
    return this.request('/api/v1/datasources');
  }

  async createDatasource(req: Types.CreateDatasourceRequest): Promise<Types.Datasource> {
    return this.request('/api/v1/datasources', { method: 'POST', body: JSON.stringify(req) });
  }

  async getDatasource(id: string): Promise<Types.Datasource> {
    return this.request(`/api/v1/datasources/${id}`);
  }

  async deleteDatasource(id: string): Promise<void> {
    return this.request(`/api/v1/datasources/${id}`, { method: 'DELETE' });
  }

  // Provider configs CRUD
  async listProviders(): Promise<{ data: Types.ProviderConfig[]; total: number }> {
    return this.request('/api/v1/providers');
  }

  async createProvider(req: Types.CreateProviderRequest): Promise<Types.ProviderConfig> {
    return this.request('/api/v1/providers', { method: 'POST', body: JSON.stringify(req) });
  }

  async getProvider(id: string): Promise<Types.ProviderConfig> {
    return this.request(`/api/v1/providers/${id}`);
  }

  async updateProvider(id: string, req: Types.UpdateProviderRequest): Promise<Types.ProviderConfig> {
    return this.request(`/api/v1/providers/${id}`, { method: 'PATCH', body: JSON.stringify(req) });
  }

  async deleteProvider(id: string): Promise<void> {
    return this.request(`/api/v1/providers/${id}`, { method: 'DELETE' });
  }

  // Notification matrix (all channel/status counts in one request)
  async getNotificationMatrix(): Promise<Record<string, Record<string, number>>> {
    const result = await this.request<{ matrix: Record<string, Record<string, number>> }>(
      '/api/v1/notifications/matrix'
    );
    return result.matrix;
  }

  // Auth Methods
  async login(req: Types.LoginRequest): Promise<{ token: string; user: Types.User }> {
    return this.request<{ token: string; user: Types.User }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(req),
      noUserID: true,
    });
  }

  async signup(req: { email: string; password: string; name: string }): Promise<{ token: string; user: Types.User; application: { id: string; name: string } }> {
    return this.request<{ token: string; user: Types.User; application: { id: string; name: string } }>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(req),
      noUserID: true,
    });
  }

  async getMe(): Promise<{ user: Types.User }> {
    return this.request<{ user: Types.User }>('/api/v1/auth/me', {
      noUserID: true,
    });
  }

  // Application Methods
  async listApplications(): Promise<{ applications: Types.Application[] }> {
    return this.request<{ applications: Types.Application[] }>('/api/v1/applications', {
      noUserID: true,
    });
  }

  async createApplication(req: { name: string; description?: string }): Promise<{ application: Types.Application }> {
    return this.request<{ application: Types.Application }>('/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify(req),
      noUserID: true,
    });
  }

  async deleteApplication(appId: string): Promise<Types.MessageResponse> {
    return this.request<Types.MessageResponse>(`/api/v1/applications/${appId}`, {
      method: 'DELETE',
      noUserID: true,
    });
  }

  async listAPIKeys(appId: string): Promise<{ api_keys: Types.APIKey[] }> {
    return this.request<{ api_keys: Types.APIKey[] }>(`/api/v1/applications/${appId}/keys`, {
      noUserID: true,
    });
  }

  async createAPIKey(appId: string, req: { name: string; description?: string; environment?: string; scopes?: string[] }): Promise<{ raw_key: string; api_key: Types.APIKey }> {
    return this.request<{ raw_key: string; api_key: Types.APIKey }>(`/api/v1/applications/${appId}/keys`, {
      method: 'POST',
      body: JSON.stringify(req),
      noUserID: true,
    });
  }

  async deleteAPIKey(appId: string, keyId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/applications/${appId}/keys/${keyId}`, {
      method: 'DELETE',
      noUserID: true,
    });
  }

  // User Account Administration (Only for system owners)
  async listUsers(): Promise<{ users: Types.User[] }> {
    return this.request<{ users: Types.User[] }>('/api/v1/users', {
      noUserID: true,
    });
  }

  async createUser(req: { name: string; email: string; password: string; role?: string }): Promise<{ user: Types.User }> {
    return this.request<{ user: Types.User }>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(req),
      noUserID: true,
    });
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/users/${id}`, {
      method: 'DELETE',
      noUserID: true,
    });
  }

  // Application Workspace Members Management
  async listApplicationMembers(appId: string): Promise<{ members: Types.ApplicationMemberDetail[] }> {
    return this.request<{ members: Types.ApplicationMemberDetail[] }>(`/api/v1/applications/${appId}/members`, {
      noUserID: true,
    });
  }

  async addApplicationMember(appId: string, req: { email: string; role?: string }): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/applications/${appId}/members`, {
      method: 'POST',
      body: JSON.stringify(req),
      noUserID: true,
    });
  }

  async removeApplicationMember(appId: string, userId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/applications/${appId}/members/${userId}`, {
      method: 'DELETE',
      noUserID: true,
    });
  }
}

export const api = new APIClient();
