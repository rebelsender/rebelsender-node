import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RebelSender } from './client';
import {
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  RebelSenderError,
} from './errors';

/* ─── Helpers ─── */

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers?.[key.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
  });
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/* ─── Constructor ─── */

describe('RebelSender constructor', () => {
  it('accepts a string API key', () => {
    const client = new RebelSender('rs_live_test123');
    expect(client).toBeDefined();
  });

  it('accepts a config object', () => {
    const client = new RebelSender({
      apiKey: 'rs_live_test123',
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      retries: 0,
    });
    expect(client).toBeDefined();
  });

  it('throws if no API key provided', () => {
    expect(() => new RebelSender('')).toThrow('API key is required');
  });

  it('throws if config has empty API key', () => {
    expect(() => new RebelSender({ apiKey: '' })).toThrow('API key is required');
  });
});

/* ─── Email sending ─── */

describe('emails.send', () => {
  it('sends a POST to /api/v1/emails with correct body', async () => {
    const responseBody = {
      id: 'em_123',
      from: 'test@co.com',
      to: ['user@gmail.com'],
      subject: 'Hello',
      status: 'QUEUED',
      createdAt: '2026-03-11T00:00:00Z',
    };

    globalThis.fetch = mockFetch(201, responseBody);
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const result = await client.send({
      from: 'test@co.com',
      to: 'user@gmail.com',
      subject: 'Hello',
      html: '<h1>Hi</h1>',
    });

    expect(result).toEqual(responseBody);

    // Verify fetch was called correctly
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/emails');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer rs_live_test');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.from).toBe('test@co.com');
    expect(body.to).toEqual(['user@gmail.com']); // string → array
    expect(body.subject).toBe('Hello');
    expect(body.html).toBe('<h1>Hi</h1>');
  });

  it('converts string `to` to array', async () => {
    globalThis.fetch = mockFetch(201, { id: 'em_123' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await client.send({ from: 'a@b.com', to: 'c@d.com', subject: 'x' });

    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.to).toEqual(['c@d.com']);
  });

  it('converts Date scheduledAt to ISO string', async () => {
    globalThis.fetch = mockFetch(201, { id: 'em_123' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });
    const date = new Date('2026-03-15T09:00:00Z');

    await client.send({ from: 'a@b.com', to: 'c@d.com', subject: 'x', scheduledAt: date });

    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.scheduledAt).toBe('2026-03-15T09:00:00.000Z');
  });

  it('passes tags, headers, and idempotencyKey', async () => {
    globalThis.fetch = mockFetch(201, { id: 'em_123' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await client.send({
      from: 'a@b.com',
      to: 'c@d.com',
      subject: 'x',
      tags: ['billing'],
      headers: { 'X-Custom': 'val' },
      idempotencyKey: 'idem_123',
    });

    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.tags).toEqual(['billing']);
    expect(body.headers).toEqual({ 'X-Custom': 'val' });
    expect(body.idempotencyKey).toBe('idem_123');
  });
});

/* ─── Batch sending ─── */

describe('emails.sendBatch', () => {
  it('sends POST to /api/v1/emails/batch', async () => {
    const responseBody = { data: [{ id: 'em_1' }, { id: 'em_2' }], errors: [], total: 2, successful: 2, failed: 0 };
    globalThis.fetch = mockFetch(201, responseBody);
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const result = await client.emails.sendBatch([
      { from: 'a@b.com', to: 'c@d.com', subject: 'Hi A' },
      { from: 'a@b.com', to: 'e@f.com', subject: 'Hi B' },
    ]);

    expect(result.successful).toBe(2);
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/emails/batch');
  });
});

/* ─── Email retrieval ─── */

describe('emails.list', () => {
  it('sends GET with query params', async () => {
    globalThis.fetch = mockFetch(200, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await client.emails.list({ status: 'DELIVERED', limit: 50, tag: 'billing' });

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('status')).toBe('DELIVERED');
    expect(parsed.searchParams.get('limit')).toBe('50');
    expect(parsed.searchParams.get('tag')).toBe('billing');
  });
});

describe('emails.get', () => {
  it('sends GET to /api/v1/emails/:id', async () => {
    globalThis.fetch = mockFetch(200, { id: 'em_123', status: 'DELIVERED' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const email = await client.emails.get('em_123');
    expect(email.id).toBe('em_123');

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/emails/em_123');
  });
});

describe('emails.cancel', () => {
  it('sends DELETE to /api/v1/emails/:id', async () => {
    globalThis.fetch = mockFetch(204, undefined);
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await client.emails.cancel('em_123');

    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/emails/em_123');
    expect(options.method).toBe('DELETE');
  });
});

/* ─── Domains ─── */

describe('domains', () => {
  it('creates a domain', async () => {
    globalThis.fetch = mockFetch(201, { id: 'dom_123', name: 'co.com', status: 'PENDING' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const domain = await client.domains.create({ name: 'co.com' });
    expect(domain.name).toBe('co.com');
  });

  it('lists domains (bare array response)', async () => {
    globalThis.fetch = mockFetch(200, [{ id: 'dom_1' }]);
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const { data } = await client.domains.list();
    expect(data).toHaveLength(1);
  });

  it('lists domains (wrapped response)', async () => {
    globalThis.fetch = mockFetch(200, { data: [{ id: 'dom_1' }] });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const { data } = await client.domains.list();
    expect(data).toHaveLength(1);
  });

  it('verifies a domain', async () => {
    globalThis.fetch = mockFetch(200, { id: 'dom_123', status: 'VERIFIED' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const domain = await client.domains.verify('dom_123');
    expect(domain.status).toBe('VERIFIED');

    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/domains/dom_123/verify');
    expect(options.method).toBe('POST');
  });
});

/* ─── Webhooks ─── */

describe('webhooks', () => {
  it('creates a webhook', async () => {
    globalThis.fetch = mockFetch(201, { data: { id: 'wh_1', secret: 'whsec_xxx' } });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const { data } = await client.webhooks.create({
      url: 'https://app.com/hook',
      events: ['DELIVERED', 'BOUNCED'],
    });

    expect(data.secret).toBe('whsec_xxx');
  });
});

/* ─── Templates ─── */

describe('templates', () => {
  it('creates and updates a template (wrapped response)', async () => {
    globalThis.fetch = mockFetch(201, { data: { id: 'tmpl_1', name: 'Welcome' } });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const tmpl = await client.templates.create({
      name: 'Welcome',
      subject: 'Hi {{name}}',
      htmlBody: '<h1>Welcome {{name}}</h1>',
    });
    expect(tmpl.name).toBe('Welcome');

    globalThis.fetch = mockFetch(200, { data: { id: 'tmpl_1', name: 'Welcome v2' } });
    const updated = await client.templates.update('tmpl_1', { name: 'Welcome v2' });
    expect(updated.name).toBe('Welcome v2');
  });
});

/* ─── Suppressions ─── */

describe('suppressions', () => {
  it('checks suppression status', async () => {
    globalThis.fetch = mockFetch(200, { suppressed: false });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const result = await client.suppressions.check('user@gmail.com');
    expect(result.suppressed).toBe(false);

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(new URL(url).searchParams.get('email')).toBe('user@gmail.com');
  });
});

/* ─── Analytics ─── */

describe('analytics', () => {
  it('fetches overview (wrapped response)', async () => {
    const stats = { sent: 100, delivered: 98, openRate: 0.42 };
    globalThis.fetch = mockFetch(200, { data: stats });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    const result = await client.analytics.overview();
    expect(result.sent).toBe(100);
  });
});

/* ─── Error handling ─── */

describe('error handling', () => {
  it('throws AuthenticationError on 401', async () => {
    globalThis.fetch = mockFetch(401, { message: 'Invalid API key' });
    const client = new RebelSender({ apiKey: 'bad_key', baseUrl: 'http://localhost:3000' });

    await expect(client.send({ from: 'a@b.com', to: 'c@d.com', subject: 'x' }))
      .rejects.toThrow(AuthenticationError);
  });

  it('throws NotFoundError on 404', async () => {
    globalThis.fetch = mockFetch(404, { message: 'Email not found' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await expect(client.emails.get('em_nonexistent'))
      .rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError on 422 with details', async () => {
    globalThis.fetch = mockFetch(422, {
      message: 'Validation failed',
      details: [{ field: 'to', message: 'required' }],
    });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    try {
      await client.send({ from: 'a@b.com', to: '', subject: '' });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details).toEqual([{ field: 'to', message: 'required' }]);
    }
  });

  it('throws RateLimitError on 429 with retryAfter', async () => {
    globalThis.fetch = mockFetch(429, { message: 'Too many requests' }, { 'retry-after': '30' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    try {
      await client.send({ from: 'a@b.com', to: 'c@d.com', subject: 'x' });
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(30);
    }
  });

  it('throws RebelSenderError on other 4xx', async () => {
    globalThis.fetch = mockFetch(403, { message: 'Forbidden', code: 'FORBIDDEN' });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await expect(client.send({ from: 'a@b.com', to: 'c@d.com', subject: 'x' }))
      .rejects.toThrow(RebelSenderError);
  });
});

/* ─── Base URL handling ─── */

describe('base URL handling', () => {
  it('strips trailing slashes', async () => {
    globalThis.fetch = mockFetch(200, { data: [] });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000///' });

    await client.domains.list();

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/domains');
  });

  it('defaults to production URL', async () => {
    globalThis.fetch = mockFetch(200, { data: [] });
    const client = new RebelSender('rs_live_test');

    await client.domains.list();

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.rebelsender.com/api/v1/domains');
  });
});

/* ─── User-Agent header ─── */

describe('headers', () => {
  it('sends User-Agent header', async () => {
    globalThis.fetch = mockFetch(200, { data: [] });
    const client = new RebelSender({ apiKey: 'rs_live_test', baseUrl: 'http://localhost:3000' });

    await client.domains.list();

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers['User-Agent']).toMatch(/^rebelsender-node\//);
  });
});
