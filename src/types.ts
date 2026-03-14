/* ─── Configuration ─── */

export interface RebelSenderConfig {
  /** API key (starts with rs_live_ or rs_test_) */
  apiKey: string;
  /** Base URL override (default: https://api.rebelsender.com) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Number of retries on 5xx/network errors (default: 2) */
  retries?: number;
}

/* ─── Email ─── */

export interface SendEmailOptions {
  /** Sender address (e.g. "you@startup.com" or "Name <you@startup.com>") */
  from: string;
  /** Recipient address(es) */
  to: string | string[];
  /** Subject line */
  subject: string;
  /** HTML body */
  html?: string;
  /** Plain text body */
  text?: string;
  /** CC addresses */
  cc?: string | string[];
  /** BCC addresses */
  bcc?: string | string[];
  /** Reply-to address */
  replyTo?: string;
  /** Template ID to render */
  templateId?: string;
  /** Template variables */
  templateData?: Record<string, unknown>;
  /** Tags for analytics grouping */
  tags?: string[];
  /** Custom email headers */
  headers?: Record<string, string>;
  /** Schedule for later (ISO 8601) */
  scheduledAt?: string | Date;
  /** Idempotency key for deduplication */
  idempotencyKey?: string;
}

export interface SendEmailResponse {
  id: string;
  from: string;
  to: string[];
  subject: string;
  status: 'QUEUED' | 'SCHEDULED';
  scheduledAt?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface BatchSendResponse {
  data: SendEmailResponse[];
  errors: Array<{ index: number; error: string }>;
  total: number;
  successful: number;
  failed: number;
}

/* ─── Email retrieval ─── */

export type EmailStatus =
  | 'QUEUED'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'REJECTED'
  | 'FAILED';

export interface ListEmailsOptions {
  page?: number;
  limit?: number;
  status?: EmailStatus;
  domainId?: string;
  tag?: string;
  from?: string;
  to?: string;
}

export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  status: EmailStatus;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
}

export interface EmailDetail extends Email {
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  html?: string;
  text?: string;
  tags: string[];
  headers?: Record<string, string>;
  events: EmailEvent[];
}

export interface EmailEvent {
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* ─── Domains ─── */

export interface CreateDomainOptions {
  name: string;
  provider?: 'AWS_SES' | 'AZURE_CS';
  region?: string;
}

export interface Domain {
  id: string;
  name: string;
  status: string;
  provider: string;
  dnsRecords?: DnsRecord[];
  createdAt: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status: string;
}

/* ─── API Keys ─── */

export interface CreateApiKeyOptions {
  name: string;
  scopes?: string[];
  expiresAt?: string | Date;
}

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // only returned on creation
  prefix: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
}

/* ─── Webhooks ─── */

export type WebhookEvent = 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'OPENED' | 'CLICKED';

export interface CreateWebhookOptions {
  url: string;
  events: WebhookEvent[];
  active?: boolean;
}

export interface UpdateWebhookOptions {
  url?: string;
  events?: WebhookEvent[];
  active?: boolean;
}

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  secret?: string; // only returned on creation
  createdAt: string;
}

/* ─── Templates ─── */

export interface CreateTemplateOptions {
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface UpdateTemplateOptions {
  name?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Suppressions ─── */

export interface Suppression {
  email: string;
  reason: string;
  createdAt: string;
}

/* ─── Auth ─── */

export interface ForgotPasswordOptions {
  email: string;
}

export interface ResetPasswordOptions {
  token: string;
  password: string;
}

export interface AuthMessageResponse {
  message: string;
}

/* ─── Senders ─── */

export interface CreateSenderOptions {
  /** Username part of the sender address (e.g. "noreply") */
  username: string;
  /** Display name (e.g. "No Reply") */
  displayName: string;
}

export interface Sender {
  id: string;
  domainId: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface SenderWithDomain extends Sender {
  domain: {
    name: string;
    provider: 'AWS_SES' | 'AZURE_CS';
  };
}

/* ─── Domain Warmup ─── */

export interface WarmupOptions {
  /** Days to stay in each warmup stage (1–7) */
  daysPerStage?: number;
  /** Custom daily send limits per stage (2–20 stages) */
  customLimits?: number[];
}

export interface WarmupStage {
  stage: number;
  dailyLimit: number;
  active: boolean;
}

export interface WarmupStatus {
  enabled: boolean;
  completed: boolean;
  currentStage: number;
  totalStages: number;
  dailySentToday: number;
  dailyLimit: number | null;
  stageTotalSent: number;
  daysInStage: number;
  daysPerStage: number;
  customLimits: number[];
  startedAt: string | null;
  completedAt: string | null;
  stages: WarmupStage[];
}

export interface WarmupRecord {
  id: string;
  domainId: string;
  enabled: boolean;
  currentStage: number;
  dailySentToday: number;
  daysPerStage: number;
  customLimits: number[];
  startedAt: string | null;
  completedAt: string | null;
}

/* ─── Domain Connect ─── */

export interface DomainConnectUrl {
  url: string;
}

/* ─── Domain Relink ─── */

export interface RelinkResult {
  success: boolean;
  message: string;
}

/* ─── Webhook Logs ─── */

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  response: string | null;
  success: boolean;
  attempts: number;
  createdAt: string;
}

/* ─── Analytics ─── */

export interface AnalyticsQuery {
  /** Number of days to look back (default: 30) */
  days?: number;
}

export interface DomainAnalytics {
  domainId: string;
  domain: string;
  sent: number;
  delivered: number;
  bounced: number;
  opens: number;
}

export interface TagAnalytics {
  tag: string;
  sent: number;
  delivered: number;
  bounced: number;
  opens: number;
  clicks: number;
}

export interface AnalyticsOverview {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

export interface TimeseriesPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
}
