interface RebelSenderConfig {
    /** API key (starts with rs_live_ or rs_test_) */
    apiKey: string;
    /** Base URL override (default: https://api.rebelsender.com) */
    baseUrl?: string;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
    /** Number of retries on 5xx/network errors (default: 2) */
    retries?: number;
}
interface SendEmailOptions {
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
interface SendEmailResponse {
    id: string;
    from: string;
    to: string[];
    subject: string;
    status: 'QUEUED' | 'SCHEDULED';
    scheduledAt?: string;
    idempotencyKey?: string;
    createdAt: string;
}
interface BatchSendResponse {
    data: SendEmailResponse[];
    errors: Array<{
        index: number;
        error: string;
    }>;
    total: number;
    successful: number;
    failed: number;
}
type EmailStatus = 'QUEUED' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'REJECTED' | 'FAILED';
interface ListEmailsOptions {
    page?: number;
    limit?: number;
    status?: EmailStatus;
    domainId?: string;
    tag?: string;
    from?: string;
    to?: string;
}
interface Email {
    id: string;
    from: string;
    to: string[];
    subject: string;
    status: EmailStatus;
    createdAt: string;
    sentAt?: string;
    deliveredAt?: string;
}
interface EmailDetail extends Email {
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    html?: string;
    text?: string;
    tags: string[];
    headers?: Record<string, string>;
    events: EmailEvent[];
}
interface EmailEvent {
    type: string;
    timestamp: string;
    data?: Record<string, unknown>;
}
interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
interface CreateDomainOptions {
    name: string;
    provider?: 'AWS_SES' | 'AZURE_CS';
    region?: string;
}
interface Domain {
    id: string;
    name: string;
    status: string;
    provider: string;
    dnsRecords?: DnsRecord[];
    createdAt: string;
}
interface DnsRecord {
    type: string;
    name: string;
    value: string;
    status: string;
}
interface CreateApiKeyOptions {
    name: string;
    scopes?: string[];
    expiresAt?: string | Date;
}
interface ApiKey {
    id: string;
    name: string;
    key?: string;
    prefix: string;
    scopes: string[];
    expiresAt?: string;
    createdAt: string;
}
type WebhookEvent = 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'OPENED' | 'CLICKED';
interface CreateWebhookOptions {
    url: string;
    events: WebhookEvent[];
    active?: boolean;
}
interface UpdateWebhookOptions {
    url?: string;
    events?: WebhookEvent[];
    active?: boolean;
}
interface Webhook {
    id: string;
    url: string;
    events: WebhookEvent[];
    active: boolean;
    secret?: string;
    createdAt: string;
}
interface CreateTemplateOptions {
    name: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
}
interface UpdateTemplateOptions {
    name?: string;
    subject?: string;
    htmlBody?: string;
    textBody?: string;
}
interface Template {
    id: string;
    name: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    createdAt: string;
    updatedAt: string;
}
interface Suppression {
    email: string;
    reason: string;
    createdAt: string;
}
interface ForgotPasswordOptions {
    email: string;
}
interface ResetPasswordOptions {
    token: string;
    password: string;
}
interface AuthMessageResponse {
    message: string;
}
interface CreateSenderOptions {
    /** Username part of the sender address (e.g. "noreply") */
    username: string;
    /** Display name (e.g. "No Reply") */
    displayName: string;
}
interface Sender {
    id: string;
    domainId: string;
    username: string;
    displayName: string;
    email: string;
    createdAt: string;
    updatedAt: string;
}
interface SenderWithDomain extends Sender {
    domain: {
        name: string;
        provider: 'AWS_SES' | 'AZURE_CS';
    };
}
interface WarmupOptions {
    /** Days to stay in each warmup stage (1–7) */
    daysPerStage?: number;
    /** Custom daily send limits per stage (2–20 stages) */
    customLimits?: number[];
}
interface WarmupStage {
    stage: number;
    dailyLimit: number;
    active: boolean;
}
interface WarmupStatus {
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
interface WarmupRecord {
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
interface DomainConnectUrl {
    url: string;
}
interface RelinkResult {
    success: boolean;
    message: string;
}
interface WebhookDeliveryLog {
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
interface AnalyticsQuery {
    /** Number of days to look back (default: 30) */
    days?: number;
}
interface DomainAnalytics {
    domainId: string;
    domain: string;
    sent: number;
    delivered: number;
    bounced: number;
    opens: number;
}
interface TagAnalytics {
    tag: string;
    sent: number;
    delivered: number;
    bounced: number;
    opens: number;
    clicks: number;
}
interface AnalyticsOverview {
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
interface TimeseriesPoint {
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
}

declare class RebelSender {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeout;
    private readonly retries;
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
    constructor(apiKeyOrConfig: string | RebelSenderConfig);
    /**
     * Shorthand: send a single email.
     *
     * ```ts
     * await rebel.send({ from: 'you@co.com', to: 'user@gmail.com', subject: 'Hi', html: '<h1>Hello</h1>' });
     * ```
     */
    send(options: SendEmailOptions): Promise<SendEmailResponse>;
    /** @internal */
    _request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T>;
}
declare class Auth {
    private client;
    constructor(client: RebelSender);
    /** Request a password reset email. Always returns success to prevent email enumeration. */
    forgotPassword(options: ForgotPasswordOptions): Promise<AuthMessageResponse>;
    /** Reset password using a token from the reset email. */
    resetPassword(options: ResetPasswordOptions): Promise<AuthMessageResponse>;
}
declare class Emails {
    private client;
    constructor(client: RebelSender);
    send(options: SendEmailOptions): Promise<SendEmailResponse>;
    sendBatch(emails: SendEmailOptions[]): Promise<BatchSendResponse>;
    list(options?: ListEmailsOptions): Promise<PaginatedResponse<Email>>;
    get(id: string): Promise<EmailDetail>;
    cancel(id: string): Promise<void>;
}
declare class Domains {
    private client;
    constructor(client: RebelSender);
    create(options: CreateDomainOptions): Promise<Domain>;
    list(): Promise<{
        data: Domain[];
    }>;
    get(id: string): Promise<Domain>;
    verify(id: string): Promise<Domain>;
    delete(id: string): Promise<void>;
    listSenders(domainId: string): Promise<Sender[]>;
    createSender(domainId: string, options: CreateSenderOptions): Promise<Sender>;
    deleteSender(domainId: string, senderId: string): Promise<void>;
    getWarmup(domainId: string): Promise<{
        data: WarmupStatus;
    }>;
    startWarmup(domainId: string, options?: WarmupOptions): Promise<{
        data: WarmupRecord;
        message: string;
    }>;
    updateWarmup(domainId: string, options: WarmupOptions): Promise<{
        data: WarmupRecord;
        message: string;
    }>;
    stopWarmup(domainId: string): Promise<{
        message: string;
    }>;
    getDomainConnectUrl(domainId: string): Promise<{
        data: DomainConnectUrl;
    }>;
    relink(domainId: string): Promise<RelinkResult>;
}
declare class Senders {
    private client;
    constructor(client: RebelSender);
    list(): Promise<SenderWithDomain[]>;
}
declare class ApiKeys {
    private client;
    constructor(client: RebelSender);
    create(options: CreateApiKeyOptions): Promise<ApiKey>;
    list(): Promise<{
        data: ApiKey[];
    }>;
    revoke(id: string): Promise<void>;
}
declare class Webhooks {
    private client;
    constructor(client: RebelSender);
    create(options: CreateWebhookOptions): Promise<{
        data: Webhook;
    }>;
    list(): Promise<{
        data: Webhook[];
    }>;
    update(id: string, options: UpdateWebhookOptions): Promise<Webhook>;
    delete(id: string): Promise<void>;
    getLogs(webhookId: string, query?: {
        page?: number;
        limit?: number;
    }): Promise<{
        data: WebhookDeliveryLog[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
}
declare class Templates {
    private client;
    constructor(client: RebelSender);
    create(options: CreateTemplateOptions): Promise<Template>;
    list(): Promise<{
        data: Template[];
    }>;
    get(id: string): Promise<Template>;
    update(id: string, options: UpdateTemplateOptions): Promise<Template>;
    delete(id: string): Promise<void>;
}
declare class Suppressions {
    private client;
    constructor(client: RebelSender);
    list(): Promise<{
        data: Suppression[];
    }>;
    add(email: string, reason?: string): Promise<void>;
    addBulk(emails: string[]): Promise<void>;
    remove(email: string): Promise<void>;
    check(email: string): Promise<{
        suppressed: boolean;
    }>;
}
declare class Analytics {
    private client;
    constructor(client: RebelSender);
    overview(query?: AnalyticsQuery): Promise<AnalyticsOverview>;
    timeseries(query?: AnalyticsQuery): Promise<{
        data: TimeseriesPoint[];
    }>;
    byDomain(query?: AnalyticsQuery): Promise<{
        data: DomainAnalytics[];
    }>;
    byTag(query?: AnalyticsQuery): Promise<{
        data: TagAnalytics[];
    }>;
}

declare class RebelSenderError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: unknown;
    constructor(message: string, status: number, code: string, details?: unknown);
}
declare class ValidationError extends RebelSenderError {
    constructor(message: string, details?: unknown);
}
declare class AuthenticationError extends RebelSenderError {
    constructor(message?: string);
}
declare class RateLimitError extends RebelSenderError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
declare class NotFoundError extends RebelSenderError {
    constructor(message?: string);
}

export { type AnalyticsOverview, type AnalyticsQuery, type ApiKey, type AuthMessageResponse, AuthenticationError, type BatchSendResponse, type CreateApiKeyOptions, type CreateDomainOptions, type CreateSenderOptions, type CreateTemplateOptions, type CreateWebhookOptions, type DnsRecord, type Domain, type DomainAnalytics, type DomainConnectUrl, type Email, type EmailDetail, type EmailEvent, type EmailStatus, type ForgotPasswordOptions, type ListEmailsOptions, NotFoundError, type PaginatedResponse, RateLimitError, RebelSender, type RebelSenderConfig, RebelSenderError, type RelinkResult, type ResetPasswordOptions, type SendEmailOptions, type SendEmailResponse, type Sender, type SenderWithDomain, type Suppression, type TagAnalytics, type Template, type TimeseriesPoint, type UpdateTemplateOptions, type UpdateWebhookOptions, ValidationError, type WarmupOptions, type WarmupRecord, type WarmupStage, type WarmupStatus, type Webhook, type WebhookDeliveryLog, type WebhookEvent };
