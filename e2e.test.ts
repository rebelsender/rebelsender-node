/**
 * E2E test for RebelSender SDK
 *
 * Runs against the real API. Requires:
 *   RS_API_KEY=rs_live_...     — your API key
 *   RS_FROM=you@yourdomain.com — a verified sender
 *   RS_TO=test@gmail.com       — recipient for test emails
 *   RS_BASE_URL=               — optional, defaults to https://api.rebelsender.com
 *
 * Usage:
 *   RS_API_KEY=rs_live_xxx RS_FROM=you@co.com RS_TO=test@co.com npx vitest run e2e.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { RebelSender, RebelSenderError } from './src/index';

const API_KEY = process.env.RS_API_KEY;
const FROM = process.env.RS_FROM;
const TO = process.env.RS_TO;
const BASE_URL = process.env.RS_BASE_URL;

let client: RebelSender;

beforeAll(() => {
  if (!API_KEY || !FROM || !TO) {
    console.log('\n⚠️  Skipping E2E tests — set RS_API_KEY, RS_FROM, RS_TO env vars\n');
    return;
  }

  client = new RebelSender({
    apiKey: API_KEY,
    ...(BASE_URL && { baseUrl: BASE_URL }),
  });
});

const skip = () => !API_KEY || !FROM || !TO;

describe('E2E: Email sending', () => {
  it.skipIf(skip())('sends a single email', async () => {
    const result = await client.send({
      from: FROM!,
      to: TO!,
      subject: `[E2E Test] ${new Date().toISOString()}`,
      html: '<h1>E2E Test</h1><p>This email was sent by the RebelSender SDK E2E test suite.</p>',
      tags: ['e2e-test'],
    });

    expect(result.id).toBeTruthy();
    expect(result.status).toBe('QUEUED');
    expect(result.to).toContain(TO);
    console.log(`  ✓ Email sent: ${result.id}`);
  });

  it.skipIf(skip())('retrieves the sent email', async () => {
    // Send first
    const sent = await client.send({
      from: FROM!,
      to: TO!,
      subject: `[E2E Retrieve] ${new Date().toISOString()}`,
      html: '<p>Retrieve test</p>',
      tags: ['e2e-test'],
    });

    // Fetch it back
    const email = await client.emails.get(sent.id);
    expect(email.id).toBe(sent.id);
    expect(email.from).toBe(FROM);
    expect(email.subject).toContain('[E2E Retrieve]');
    console.log(`  ✓ Email retrieved: ${email.id} — status: ${email.status}`);
  });

  it.skipIf(skip())('lists emails with tag filter', async () => {
    const { data, pagination } = await client.emails.list({
      tag: 'e2e-test',
      limit: 5,
    });

    expect(Array.isArray(data)).toBe(true);
    expect(pagination.limit).toBe(5);
    console.log(`  ✓ Listed ${data.length} emails (total: ${pagination.total})`);
  });
});

describe('E2E: Batch sending', () => {
  it.skipIf(skip())('sends a batch of 2 emails', async () => {
    const result = await client.emails.sendBatch([
      { from: FROM!, to: TO!, subject: `[E2E Batch 1] ${Date.now()}`, html: '<p>Batch 1</p>', tags: ['e2e-test'] },
      { from: FROM!, to: TO!, subject: `[E2E Batch 2] ${Date.now()}`, html: '<p>Batch 2</p>', tags: ['e2e-test'] },
    ]);

    expect(result.successful).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.data).toHaveLength(2);
    console.log(`  ✓ Batch sent: ${result.data.map((d) => d.id).join(', ')}`);
  });
});

describe('E2E: Domains', () => {
  it.skipIf(skip())('lists domains', async () => {
    const { data } = await client.domains.list();
    expect(Array.isArray(data)).toBe(true);
    console.log(`  ✓ Found ${data.length} domains`);
  });
});

describe('E2E: Webhooks', () => {
  let webhookId: string | undefined;

  it.skipIf(skip())('creates a webhook', async () => {
    const { data } = await client.webhooks.create({
      url: 'https://httpbin.org/post',
      events: ['DELIVERED', 'BOUNCED'],
    });

    expect(data.id).toBeTruthy();
    expect(data.secret).toBeTruthy();
    webhookId = data.id;
    console.log(`  ✓ Webhook created: ${data.id}`);
  });

  it.skipIf(skip())('lists webhooks', async () => {
    const { data } = await client.webhooks.list();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((w) => w.id === webhookId)).toBe(true);
    console.log(`  ✓ Found ${data.length} webhooks`);
  });

  it.skipIf(skip())('deletes the test webhook', async () => {
    if (!webhookId) return;
    await client.webhooks.delete(webhookId);
    console.log(`  ✓ Webhook deleted: ${webhookId}`);
  });
});

describe('E2E: Templates', () => {
  let templateId: string | undefined;

  it.skipIf(skip())('creates a template', async () => {
    const tmpl = await client.templates.create({
      name: `E2E Test Template ${Date.now()}`,
      subject: 'Hello {{name}}',
      htmlBody: '<h1>Welcome {{name}}</h1><p>Plan: {{plan}}</p>',
    });

    expect(tmpl.id).toBeTruthy();
    templateId = tmpl.id;
    console.log(`  ✓ Template created: ${tmpl.id}`);
  });

  it.skipIf(skip())('sends with template', async () => {
    if (!templateId) return;

    const result = await client.send({
      from: FROM!,
      to: TO!,
      subject: `[E2E Template] ${new Date().toISOString()}`,
      templateId,
      templateData: { name: 'E2E Tester', plan: 'Pro' },
      tags: ['e2e-test'],
    });

    expect(result.id).toBeTruthy();
    console.log(`  ✓ Template email sent: ${result.id}`);
  });

  it.skipIf(skip())('deletes the test template', async () => {
    if (!templateId) return;
    await client.templates.delete(templateId);
    console.log(`  ✓ Template deleted: ${templateId}`);
  });
});

describe('E2E: Suppressions', () => {
  const testEmail = `e2e-suppress-${Date.now()}@test.example.com`;

  it.skipIf(skip())('adds and checks a suppression', async () => {
    await client.suppressions.add(testEmail, 'MANUAL');

    const { suppressed } = await client.suppressions.check(testEmail);
    expect(suppressed).toBe(true);
    console.log(`  ✓ ${testEmail} suppressed`);
  });

  it.skipIf(skip())('removes the suppression', async () => {
    await client.suppressions.remove(testEmail);

    const { suppressed } = await client.suppressions.check(testEmail);
    expect(suppressed).toBe(false);
    console.log(`  ✓ ${testEmail} unsuppressed`);
  });
});

describe('E2E: Analytics', () => {
  it.skipIf(skip())('fetches overview stats', async () => {
    const stats = await client.analytics.overview();
    expect(typeof stats.sent).toBe('number');
    expect(typeof stats.delivered).toBe('number');
    console.log(`  ✓ Analytics: ${stats.sent} sent, ${stats.delivered} delivered`);
  });
});

describe('E2E: Error handling', () => {
  it.skipIf(skip())('returns 404 for non-existent email', async () => {
    try {
      await client.emails.get('em_does_not_exist_999');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RebelSenderError);
      expect((err as RebelSenderError).status).toBe(404);
      console.log(`  ✓ 404 error handled correctly`);
    }
  });

  it('rejects invalid API key', async () => {
    const badClient = new RebelSender({
      apiKey: 'rs_live_invalid_key_xxx',
      ...(BASE_URL && { baseUrl: BASE_URL }),
    });

    try {
      await badClient.emails.list();
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RebelSenderError);
      expect((err as RebelSenderError).status).toBe(401);
      console.log(`  ✓ 401 error handled correctly`);
    }
  });
});
