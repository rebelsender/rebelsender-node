import type {
  RebelSenderConfig,
  SendEmailOptions,
  SendEmailResponse,
  BatchSendResponse,
  ListEmailsOptions,
  Email,
  EmailDetail,
  PaginatedResponse,
  CreateDomainOptions,
  Domain,
  CreateSenderOptions,
  Sender,
  SenderWithDomain,
  WarmupOptions,
  WarmupStatus,
  WarmupRecord,
  DomainConnectUrl,
  RelinkResult,
  CreateApiKeyOptions,
  ApiKey,
  CreateWebhookOptions,
  UpdateWebhookOptions,
  Webhook,
  WebhookDeliveryLog,
  CreateTemplateOptions,
  UpdateTemplateOptions,
  Template,
  Suppression,
  AnalyticsOverview,
  AnalyticsQuery,
  TimeseriesPoint,
  DomainAnalytics,
  TagAnalytics,
  ForgotPasswordOptions,
  ResetPasswordOptions,
  AuthMessageResponse,
} from './types';
import {
  RebelSenderError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
} from './errors';

const DEFAULT_BASE_URL = 'https://api.rebelsender.com';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 2;
const VERSION = '0.1.0';

function toArray(val: string | string[]): string[] {
  return Array.isArray(val) ? val : [val];
}

function toISOString(val: string | Date | undefined): string | undefined {
  if (!val) return undefined;
  return val instanceof Date ? val.toISOString() : val;
}

export class RebelSender {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;

  /** Resource namespaces */
  readonly auth: Auth;
  readonly emails: Emails;
  readonly domains: Domains;
  readonly senders: Senders;
  readonly apiKeys: ApiKeys;
  readonly webhooks: Webhooks;
  readonly templates: Templates;
  readonly suppressions: Suppressions;
  readonly analytics: Analytics;

  constructor(apiKeyOrConfig: string | RebelSenderConfig) {
    const config =
      typeof apiKeyOrConfig === 'string'
        ? { apiKey: apiKeyOrConfig }
        : apiKeyOrConfig;

    if (!config.apiKey) {
      throw new Error(
        'RebelSender: API key is required. Get one at https://app.rebelsender.com/api-keys'
      );
    }

    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;

    // Initialize resource namespaces
    this.auth = new Auth(this);
    this.emails = new Emails(this);
    this.domains = new Domains(this);
    this.senders = new Senders(this);
    this.apiKeys = new ApiKeys(this);
    this.webhooks = new Webhooks(this);
    this.templates = new Templates(this);
    this.suppressions = new Suppressions(this);
    this.analytics = new Analytics(this);
  }

  /**
   * Shorthand: send a single email.
   *
   * ```ts
   * await rebel.send({ from: 'you@co.com', to: 'user@gmail.com', subject: 'Hi', html: '<h1>Hello</h1>' });
   * ```
   */
  async send(options: SendEmailOptions): Promise<SendEmailResponse> {
    return this.emails.send(options);
  }

  /* ── Internal HTTP ── */

  /** @internal */
  async _request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
    const url = new URL(`/api/v1${path}`, this.baseUrl);

    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    let lastError: Error | null = null;
    const attempts = method === 'GET' ? this.retries + 1 : 1; // only retry idempotent requests

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 200ms, 400ms, 800ms...
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const res = await fetch(url.toString(), {
          method,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': `rebelsender-node/${VERSION}`,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          // Handle 204 No Content
          if (res.status === 204) return undefined as T;
          return (await res.json()) as T;
        }

        // Parse error response
        let errorBody: { message?: string; error?: string; code?: string; details?: unknown } = {};
        try {
          errorBody = (await res.json()) as typeof errorBody;
        } catch {
          // non-JSON error response
        }

        // API may return { error: { code, message } } or { message, code }
        const nested = (errorBody as any)?.error;
        const message = errorBody.message ?? nested?.message ?? `HTTP ${res.status}`;
        const code = errorBody.code ?? nested?.code ?? 'UNKNOWN_ERROR';

        // Don't retry client errors (except 429)
        if (res.status === 401) throw new AuthenticationError(message);
        if (res.status === 404) throw new NotFoundError(message);
        if (res.status === 422) throw new ValidationError(message, errorBody.details);
        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          throw new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : undefined);
        }

        if (res.status >= 400 && res.status < 500) {
          throw new RebelSenderError(message, res.status, code, errorBody.details);
        }

        // 5xx — retry on GET
        lastError = new RebelSenderError(message, res.status, code);
      } catch (err) {
        if (err instanceof RebelSenderError) throw err;
        lastError = err as Error;
      }
    }

    throw lastError ?? new Error('Request failed');
  }
}

/* ─── Resource: Auth ─── */

class Auth {
  constructor(private client: RebelSender) {}

  /** Request a password reset email. Always returns success to prevent email enumeration. */
  async forgotPassword(options: ForgotPasswordOptions): Promise<AuthMessageResponse> {
    return this.client._request('POST', '/auth/forgot-password', options);
  }

  /** Reset password using a token from the reset email. */
  async resetPassword(options: ResetPasswordOptions): Promise<AuthMessageResponse> {
    return this.client._request('POST', '/auth/reset-password', options);
  }
}

/* ─── Resource: Emails ─── */

class Emails {
  constructor(private client: RebelSender) {}

  async send(options: SendEmailOptions): Promise<SendEmailResponse> {
    return this.client._request('POST', '/emails', {
      from: options.from,
      to: toArray(options.to),
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc ? toArray(options.cc) : undefined,
      bcc: options.bcc ? toArray(options.bcc) : undefined,
      replyTo: options.replyTo,
      templateId: options.templateId,
      templateData: options.templateData,
      tags: options.tags,
      headers: options.headers,
      scheduledAt: toISOString(options.scheduledAt),
      idempotencyKey: options.idempotencyKey,
    });
  }

  async sendBatch(emails: SendEmailOptions[]): Promise<BatchSendResponse> {
    return this.client._request('POST', '/emails/batch', {
      emails: emails.map((e) => ({
        from: e.from,
        to: toArray(e.to),
        subject: e.subject,
        html: e.html,
        text: e.text,
        cc: e.cc ? toArray(e.cc) : undefined,
        bcc: e.bcc ? toArray(e.bcc) : undefined,
        replyTo: e.replyTo,
        templateId: e.templateId,
        templateData: e.templateData,
        tags: e.tags,
        headers: e.headers,
        scheduledAt: toISOString(e.scheduledAt),
        idempotencyKey: e.idempotencyKey,
      })),
    });
  }

  async list(options?: ListEmailsOptions): Promise<PaginatedResponse<Email>> {
    return this.client._request('GET', '/emails', undefined, options as Record<string, unknown>);
  }

  async get(id: string): Promise<EmailDetail> {
    return this.client._request('GET', `/emails/${id}`);
  }

  async cancel(id: string): Promise<void> {
    return this.client._request('DELETE', `/emails/${id}`);
  }
}

/* ─── Resource: Domains ─── */

class Domains {
  constructor(private client: RebelSender) {}

  async create(options: CreateDomainOptions): Promise<Domain> {
    return this.client._request('POST', '/domains', options);
  }

  async list(): Promise<{ data: Domain[] }> {
    const result = await this.client._request<Domain[] | { data: Domain[] }>('GET', '/domains');
    // API returns bare array; normalize to { data }
    return Array.isArray(result) ? { data: result } : result;
  }

  async get(id: string): Promise<Domain> {
    return this.client._request('GET', `/domains/${id}`);
  }

  async verify(id: string): Promise<Domain> {
    return this.client._request('POST', `/domains/${id}/verify`);
  }

  async delete(id: string): Promise<void> {
    return this.client._request('DELETE', `/domains/${id}`);
  }

  /* ── Senders ── */

  async listSenders(domainId: string): Promise<Sender[]> {
    return this.client._request('GET', `/domains/${domainId}/senders`);
  }

  async createSender(domainId: string, options: CreateSenderOptions): Promise<Sender> {
    return this.client._request('POST', `/domains/${domainId}/senders`, options);
  }

  async deleteSender(domainId: string, senderId: string): Promise<void> {
    return this.client._request('DELETE', `/domains/${domainId}/senders/${senderId}`);
  }

  /* ── Warmup ── */

  async getWarmup(domainId: string): Promise<{ data: WarmupStatus }> {
    return this.client._request('GET', `/domains/${domainId}/warmup`);
  }

  async startWarmup(domainId: string, options?: WarmupOptions): Promise<{ data: WarmupRecord; message: string }> {
    return this.client._request('POST', `/domains/${domainId}/warmup`, options);
  }

  async updateWarmup(domainId: string, options: WarmupOptions): Promise<{ data: WarmupRecord; message: string }> {
    return this.client._request('PUT', `/domains/${domainId}/warmup`, options);
  }

  async stopWarmup(domainId: string): Promise<{ message: string }> {
    return this.client._request('DELETE', `/domains/${domainId}/warmup`);
  }

  /* ── Domain Connect ── */

  async getDomainConnectUrl(domainId: string): Promise<{ data: DomainConnectUrl }> {
    return this.client._request('GET', `/domains/${domainId}/connect`);
  }

  /* ── Relink ── */

  async relink(domainId: string): Promise<RelinkResult> {
    return this.client._request('POST', `/domains/${domainId}/relink`);
  }
}

/* ─── Resource: Senders ─── */

class Senders {
  constructor(private client: RebelSender) {}

  async list(): Promise<SenderWithDomain[]> {
    return this.client._request('GET', '/senders');
  }
}

/* ─── Resource: API Keys ─── */

class ApiKeys {
  constructor(private client: RebelSender) {}

  async create(options: CreateApiKeyOptions): Promise<ApiKey> {
    return this.client._request('POST', '/api-keys', {
      ...options,
      expiresAt: toISOString(options.expiresAt),
    });
  }

  async list(): Promise<{ data: ApiKey[] }> {
    return this.client._request('GET', '/api-keys');
  }

  async revoke(id: string): Promise<void> {
    return this.client._request('DELETE', `/api-keys/${id}`);
  }
}

/* ─── Resource: Webhooks ─── */

class Webhooks {
  constructor(private client: RebelSender) {}

  async create(options: CreateWebhookOptions): Promise<{ data: Webhook }> {
    return this.client._request('POST', '/webhooks', options);
  }

  async list(): Promise<{ data: Webhook[] }> {
    return this.client._request('GET', '/webhooks');
  }

  async update(id: string, options: UpdateWebhookOptions): Promise<Webhook> {
    return this.client._request('PUT', `/webhooks/${id}`, options);
  }

  async delete(id: string): Promise<void> {
    return this.client._request('DELETE', `/webhooks/${id}`);
  }

  async getLogs(webhookId: string, query?: { page?: number; limit?: number }): Promise<{ data: WebhookDeliveryLog[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    return this.client._request('GET', `/webhooks/${webhookId}/logs`, undefined, query as Record<string, unknown>);
  }
}

/* ─── Resource: Templates ─── */

class Templates {
  constructor(private client: RebelSender) {}

  async create(options: CreateTemplateOptions): Promise<Template> {
    const result = await this.client._request<{ data: Template } | Template>('POST', '/templates', options);
    return (result as any)?.data ?? result;
  }

  async list(): Promise<{ data: Template[] }> {
    return this.client._request('GET', '/templates');
  }

  async get(id: string): Promise<Template> {
    const result = await this.client._request<{ data: Template } | Template>('GET', `/templates/${id}`);
    return (result as any)?.data ?? result;
  }

  async update(id: string, options: UpdateTemplateOptions): Promise<Template> {
    const result = await this.client._request<{ data: Template } | Template>('PUT', `/templates/${id}`, options);
    return (result as any)?.data ?? result;
  }

  async delete(id: string): Promise<void> {
    return this.client._request('DELETE', `/templates/${id}`);
  }
}

/* ─── Resource: Suppressions ─── */

class Suppressions {
  constructor(private client: RebelSender) {}

  async list(): Promise<{ data: Suppression[] }> {
    return this.client._request('GET', '/suppressions');
  }

  async add(email: string, reason?: string): Promise<void> {
    return this.client._request('POST', '/suppressions', { email, reason });
  }

  async addBulk(emails: string[]): Promise<void> {
    return this.client._request('POST', '/suppressions/bulk', { emails });
  }

  async remove(email: string): Promise<void> {
    return this.client._request('DELETE', `/suppressions/${encodeURIComponent(email)}`);
  }

  async check(email: string): Promise<{ suppressed: boolean }> {
    return this.client._request('GET', '/suppressions/check', undefined, { email });
  }
}

/* ─── Resource: Analytics ─── */

class Analytics {
  constructor(private client: RebelSender) {}

  async overview(query?: AnalyticsQuery): Promise<AnalyticsOverview> {
    const result = await this.client._request<{ data: AnalyticsOverview } | AnalyticsOverview>('GET', '/analytics/overview', undefined, query as Record<string, unknown>);
    return (result as any)?.data ?? result;
  }

  async timeseries(query?: AnalyticsQuery): Promise<{ data: TimeseriesPoint[] }> {
    return this.client._request('GET', '/analytics/timeseries', undefined, query as Record<string, unknown>);
  }

  async byDomain(query?: AnalyticsQuery): Promise<{ data: DomainAnalytics[] }> {
    return this.client._request('GET', '/analytics/domains', undefined, query as Record<string, unknown>);
  }

  async byTag(query?: AnalyticsQuery): Promise<{ data: TagAnalytics[] }> {
    return this.client._request('GET', '/analytics/tags', undefined, query as Record<string, unknown>);
  }
}
