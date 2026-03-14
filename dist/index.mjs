// src/errors.ts
var RebelSenderError = class extends Error {
  status;
  code;
  details;
  constructor(message, status, code, details) {
    super(message);
    this.name = "RebelSenderError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
};
var ValidationError = class extends RebelSenderError {
  constructor(message, details) {
    super(message, 422, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
};
var AuthenticationError = class extends RebelSenderError {
  constructor(message = "Invalid API key") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
};
var RateLimitError = class extends RebelSenderError {
  retryAfter;
  constructor(message = "Rate limit exceeded", retryAfter) {
    super(message, 429, "RATE_LIMIT_ERROR");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
};
var NotFoundError = class extends RebelSenderError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
};

// src/client.ts
var DEFAULT_BASE_URL = "https://api.rebelsender.com";
var DEFAULT_TIMEOUT = 3e4;
var DEFAULT_RETRIES = 2;
var VERSION = "0.1.0";
function toArray(val) {
  return Array.isArray(val) ? val : [val];
}
function toISOString(val) {
  if (!val) return void 0;
  return val instanceof Date ? val.toISOString() : val;
}
var RebelSender = class {
  apiKey;
  baseUrl;
  timeout;
  retries;
  /** Resource namespaces */
  auth;
  emails;
  domains;
  senders;
  apiKeys;
  webhooks;
  templates;
  suppressions;
  analytics;
  constructor(apiKeyOrConfig) {
    const config = typeof apiKeyOrConfig === "string" ? { apiKey: apiKeyOrConfig } : apiKeyOrConfig;
    if (!config.apiKey) {
      throw new Error(
        "RebelSender: API key is required. Get one at https://app.rebelsender.com/api-keys"
      );
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retries = config.retries ?? DEFAULT_RETRIES;
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
  async send(options) {
    return this.emails.send(options);
  }
  /* ── Internal HTTP ── */
  /** @internal */
  async _request(method, path, body, query) {
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== void 0 && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    let lastError = null;
    const attempts = method === "GET" ? this.retries + 1 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const res = await fetch(url.toString(), {
          method,
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": `rebelsender-node/${VERSION}`
          },
          body: body ? JSON.stringify(body) : void 0,
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          if (res.status === 204) return void 0;
          return await res.json();
        }
        let errorBody = {};
        try {
          errorBody = await res.json();
        } catch {
        }
        const nested = errorBody?.error;
        const message = errorBody.message ?? nested?.message ?? `HTTP ${res.status}`;
        const code = errorBody.code ?? nested?.code ?? "UNKNOWN_ERROR";
        if (res.status === 401) throw new AuthenticationError(message);
        if (res.status === 404) throw new NotFoundError(message);
        if (res.status === 422) throw new ValidationError(message, errorBody.details);
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          throw new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : void 0);
        }
        if (res.status >= 400 && res.status < 500) {
          throw new RebelSenderError(message, res.status, code, errorBody.details);
        }
        lastError = new RebelSenderError(message, res.status, code);
      } catch (err) {
        if (err instanceof RebelSenderError) throw err;
        lastError = err;
      }
    }
    throw lastError ?? new Error("Request failed");
  }
};
var Auth = class {
  constructor(client) {
    this.client = client;
  }
  /** Request a password reset email. Always returns success to prevent email enumeration. */
  async forgotPassword(options) {
    return this.client._request("POST", "/auth/forgot-password", options);
  }
  /** Reset password using a token from the reset email. */
  async resetPassword(options) {
    return this.client._request("POST", "/auth/reset-password", options);
  }
};
var Emails = class {
  constructor(client) {
    this.client = client;
  }
  async send(options) {
    return this.client._request("POST", "/emails", {
      from: options.from,
      to: toArray(options.to),
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc ? toArray(options.cc) : void 0,
      bcc: options.bcc ? toArray(options.bcc) : void 0,
      replyTo: options.replyTo,
      templateId: options.templateId,
      templateData: options.templateData,
      tags: options.tags,
      headers: options.headers,
      scheduledAt: toISOString(options.scheduledAt),
      idempotencyKey: options.idempotencyKey
    });
  }
  async sendBatch(emails) {
    return this.client._request("POST", "/emails/batch", {
      emails: emails.map((e) => ({
        from: e.from,
        to: toArray(e.to),
        subject: e.subject,
        html: e.html,
        text: e.text,
        cc: e.cc ? toArray(e.cc) : void 0,
        bcc: e.bcc ? toArray(e.bcc) : void 0,
        replyTo: e.replyTo,
        templateId: e.templateId,
        templateData: e.templateData,
        tags: e.tags,
        headers: e.headers,
        scheduledAt: toISOString(e.scheduledAt),
        idempotencyKey: e.idempotencyKey
      }))
    });
  }
  async list(options) {
    return this.client._request("GET", "/emails", void 0, options);
  }
  async get(id) {
    return this.client._request("GET", `/emails/${id}`);
  }
  async cancel(id) {
    return this.client._request("DELETE", `/emails/${id}`);
  }
};
var Domains = class {
  constructor(client) {
    this.client = client;
  }
  async create(options) {
    return this.client._request("POST", "/domains", options);
  }
  async list() {
    const result = await this.client._request("GET", "/domains");
    return Array.isArray(result) ? { data: result } : result;
  }
  async get(id) {
    return this.client._request("GET", `/domains/${id}`);
  }
  async verify(id) {
    return this.client._request("POST", `/domains/${id}/verify`);
  }
  async delete(id) {
    return this.client._request("DELETE", `/domains/${id}`);
  }
  /* ── Senders ── */
  async listSenders(domainId) {
    return this.client._request("GET", `/domains/${domainId}/senders`);
  }
  async createSender(domainId, options) {
    return this.client._request("POST", `/domains/${domainId}/senders`, options);
  }
  async deleteSender(domainId, senderId) {
    return this.client._request("DELETE", `/domains/${domainId}/senders/${senderId}`);
  }
  /* ── Warmup ── */
  async getWarmup(domainId) {
    return this.client._request("GET", `/domains/${domainId}/warmup`);
  }
  async startWarmup(domainId, options) {
    return this.client._request("POST", `/domains/${domainId}/warmup`, options);
  }
  async updateWarmup(domainId, options) {
    return this.client._request("PUT", `/domains/${domainId}/warmup`, options);
  }
  async stopWarmup(domainId) {
    return this.client._request("DELETE", `/domains/${domainId}/warmup`);
  }
  /* ── Domain Connect ── */
  async getDomainConnectUrl(domainId) {
    return this.client._request("GET", `/domains/${domainId}/connect`);
  }
  /* ── Relink ── */
  async relink(domainId) {
    return this.client._request("POST", `/domains/${domainId}/relink`);
  }
};
var Senders = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    return this.client._request("GET", "/senders");
  }
};
var ApiKeys = class {
  constructor(client) {
    this.client = client;
  }
  async create(options) {
    return this.client._request("POST", "/api-keys", {
      ...options,
      expiresAt: toISOString(options.expiresAt)
    });
  }
  async list() {
    return this.client._request("GET", "/api-keys");
  }
  async revoke(id) {
    return this.client._request("DELETE", `/api-keys/${id}`);
  }
};
var Webhooks = class {
  constructor(client) {
    this.client = client;
  }
  async create(options) {
    return this.client._request("POST", "/webhooks", options);
  }
  async list() {
    return this.client._request("GET", "/webhooks");
  }
  async update(id, options) {
    return this.client._request("PUT", `/webhooks/${id}`, options);
  }
  async delete(id) {
    return this.client._request("DELETE", `/webhooks/${id}`);
  }
  async getLogs(webhookId, query) {
    return this.client._request("GET", `/webhooks/${webhookId}/logs`, void 0, query);
  }
};
var Templates = class {
  constructor(client) {
    this.client = client;
  }
  async create(options) {
    const result = await this.client._request("POST", "/templates", options);
    return result?.data ?? result;
  }
  async list() {
    return this.client._request("GET", "/templates");
  }
  async get(id) {
    const result = await this.client._request("GET", `/templates/${id}`);
    return result?.data ?? result;
  }
  async update(id, options) {
    const result = await this.client._request("PUT", `/templates/${id}`, options);
    return result?.data ?? result;
  }
  async delete(id) {
    return this.client._request("DELETE", `/templates/${id}`);
  }
};
var Suppressions = class {
  constructor(client) {
    this.client = client;
  }
  async list() {
    return this.client._request("GET", "/suppressions");
  }
  async add(email, reason) {
    return this.client._request("POST", "/suppressions", { email, reason });
  }
  async addBulk(emails) {
    return this.client._request("POST", "/suppressions/bulk", { emails });
  }
  async remove(email) {
    return this.client._request("DELETE", `/suppressions/${encodeURIComponent(email)}`);
  }
  async check(email) {
    return this.client._request("GET", "/suppressions/check", void 0, { email });
  }
};
var Analytics = class {
  constructor(client) {
    this.client = client;
  }
  async overview(query) {
    const result = await this.client._request("GET", "/analytics/overview", void 0, query);
    return result?.data ?? result;
  }
  async timeseries(query) {
    return this.client._request("GET", "/analytics/timeseries", void 0, query);
  }
  async byDomain(query) {
    return this.client._request("GET", "/analytics/domains", void 0, query);
  }
  async byTag(query) {
    return this.client._request("GET", "/analytics/tags", void 0, query);
  }
};
export {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  RebelSender,
  RebelSenderError,
  ValidationError
};
