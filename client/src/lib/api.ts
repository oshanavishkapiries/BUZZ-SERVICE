import { getConfig } from './config';
import * as Types from './types';

class APIClient {
  private getHeaders(includeUserId: boolean = true) {
    const { apiKey, userId } = getConfig();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
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

  // Notification count for matrix
  async countNotifications(channel: string, status: string): Promise<number> {
    const query = new URLSearchParams({
      channel,
      status,
      limit: '1',
    });
    const result = await this.request<Types.PaginatedResponse<Types.Notification>>(
      `/api/v1/notifications?${query.toString()}`
    );
    return result.total;
  }
}

export const api = new APIClient();
