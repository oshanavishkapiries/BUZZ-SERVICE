// Enums
export type Channel = 'email' | 'sms' | 'push' | 'in_app';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'fetching' | 'queued' | 'delivering';
export type Platform = 'ios' | 'android' | 'web';
export type DatasourceType = 'google_sheets' | 'csv' | 'json' | 'api';

// Notification
export interface Notification {
  id: string;
  batch_id?: string;
  channel: Channel;
  priority: Priority;
  recipient: Record<string, unknown>;
  subject?: string;
  body: string;
  html_body?: string;
  template_id?: string;
  variables?: Record<string, unknown>;
  status: NotificationStatus;
  provider?: string;
  provider_message_id?: string;
  provider_response?: Record<string, unknown>;
  queued_at?: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  error_message?: string;
  error_code?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  deleted_at?: string;
}

// Template
export interface Template {
  id: string;
  name: string;
  description?: string;
  channels: Channel[];
  subject?: string;
  body: string;
  html_body?: string;
  variables: string[];
  default_values?: Record<string, string>;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  is_active: boolean;
  deleted_at?: string;
}

// Inbox Entry
export interface InboxEntry {
  id: string;
  user_id: string;
  notification_id?: string;
  title: string;
  body: string;
  type?: string;
  action_url?: string;
  action_text?: string;
  icon_url?: string;
  image_url?: string;
  is_read: boolean;
  is_archived: boolean;
  read_at?: string;
  archived_at?: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Device Token
export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: Platform;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deactivated_at?: string;
}

// Batch
export interface Batch {
  id: string;
  datasource_id?: string;
  datasource_name: string;
  endpoint_name: string;
  template_name: string;
  channel: Channel;
  priority: Priority;
  status: BatchStatus;
  total_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// Datasource
export interface Datasource {
  id: string;
  name: string;
  base_url: string;
  auth_type: string;
  auth_config?: Record<string, unknown>;
  endpoints?: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// API Request shapes
export interface SendNotificationRequest {
  to: string;
  channel: Channel;
  priority?: Priority;
  provider?: string;
  template?: string;
  subject?: string;
  body?: string;
  data?: Record<string, unknown>;
  recipient_id?: string;
  recipient_name?: string;
  idempotency_key?: string;
  scheduled_for?: string;
}

// Provider configs
export interface ProviderConfig {
  id: string;
  name: string;
  channel: Channel;
  provider: string;
  config: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  name: string;
  channel: Channel;
  provider: string;
  config: Record<string, unknown>;
  is_default?: boolean;
}

export interface UpdateProviderRequest {
  name?: string;
  config?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
}

export interface CreateTemplateRequest {
  name: string;
  channels?: Channel[];  // preferred: multi-channel
  channel?: Channel;     // legacy: single channel (still accepted by API)
  subject?: string;
  body: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateDatasourceRequest {
  name: string;
  base_url: string;
  auth_type?: string;
  auth_config?: Record<string, unknown>;
  endpoints?: Record<string, unknown>;
}

export interface UpdateTemplateRequest {
  channels?: Channel[];
  subject?: string;
  body?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
  active?: boolean;
}

export interface RegisterDeviceRequest {
  user_id: string;
  token: string;
  platform: Platform;
}

export interface SendBulkRequest {
  datasource_name: string;
  endpoint_name: string;
  endpoint_params?: Record<string, unknown>;
  template_name: string;
  template_data?: Record<string, unknown>;
  channel: Channel;
  priority?: Priority;
  idempotency_key?: string;
}

// API Response shapes
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessageResponse {
  message: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  checks: {
    database: 'up' | 'down';
  };
}

export interface SSEEvent {
  type: 'connected' | 'notification' | 'error' | 'disconnected';
  timestamp: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface ApplicationMemberDetail {
  application_id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Application {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface APIKey {
  id: string;
  application_id: string;
  name: string;
  description?: string;
  key_prefix: string;
  environment: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
