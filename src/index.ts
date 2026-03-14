export { RebelSender } from './client';
export type { RebelSenderConfig } from './types';

// Email types
export type {
  SendEmailOptions,
  SendEmailResponse,
  BatchSendResponse,
  ListEmailsOptions,
  Email,
  EmailDetail,
  EmailEvent,
  EmailStatus,
  PaginatedResponse,
} from './types';

// Domain types
export type {
  CreateDomainOptions,
  Domain,
  DnsRecord,
  CreateSenderOptions,
  Sender,
  SenderWithDomain,
  WarmupOptions,
  WarmupStatus,
  WarmupRecord,
  WarmupStage,
  DomainConnectUrl,
  RelinkResult,
} from './types';

// API key types
export type { CreateApiKeyOptions, ApiKey } from './types';

// Webhook types
export type {
  WebhookEvent,
  CreateWebhookOptions,
  UpdateWebhookOptions,
  Webhook,
  WebhookDeliveryLog,
} from './types';

// Template types
export type {
  CreateTemplateOptions,
  UpdateTemplateOptions,
  Template,
} from './types';

// Suppression types
export type { Suppression } from './types';

// Auth types
export type { ForgotPasswordOptions, ResetPasswordOptions, AuthMessageResponse } from './types';

// Analytics types
export type { AnalyticsOverview, AnalyticsQuery, TimeseriesPoint, DomainAnalytics, TagAnalytics } from './types';

// Error classes
export {
  RebelSenderError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from './errors';
