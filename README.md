# RebelSender Node.js SDK

The official Node.js SDK for [RebelSender](https://rebelsender.com) — high-velocity transactional email for builders.

- Zero dependencies (uses native `fetch`)
- Full TypeScript support
- Automatic retries with exponential backoff
- Typed error classes for clean error handling

## Install

```bash
npm install rebelsender
```

## Quickstart

```ts
import { RebelSender } from 'rebelsender';

const rebel = new RebelSender('rs_live_your_api_key');

await rebel.send({
  from: 'you@yourdomain.com',
  to: 'user@gmail.com',
  subject: 'Welcome aboard',
  html: '<h1>You\'re in.</h1>',
});
```

## Configuration

```ts
const rebel = new RebelSender({
  apiKey: 'rs_live_...',
  baseUrl: 'https://api.rebelsender.com', // default
  timeout: 30000,                          // 30s default
  retries: 2,                              // retries on 5xx (GET only)
});
```

## Sending emails

### Single email

```ts
const { id, status } = await rebel.send({
  from: 'alerts@yourdomain.com',
  to: 'user@gmail.com',
  subject: 'Your invoice is ready',
  html: '<h1>Invoice #1234</h1><p>Amount: $99.00</p>',
  tags: ['billing', 'invoice'],
});
```

### With templates

```ts
await rebel.send({
  from: 'noreply@yourdomain.com',
  to: 'user@gmail.com',
  templateId: 'tmpl_welcome',
  templateData: { name: 'Jane', plan: 'Pro' },
});
```

### Batch sending (up to 1,000)

```ts
const result = await rebel.emails.sendBatch([
  { from: 'you@co.com', to: 'a@gmail.com', subject: 'Hi A', html: '...' },
  { from: 'you@co.com', to: 'b@gmail.com', subject: 'Hi B', html: '...' },
]);

console.log(`${result.successful} sent, ${result.failed} failed`);
```

### Scheduled sending

```ts
await rebel.send({
  from: 'you@co.com',
  to: 'user@gmail.com',
  subject: 'Good morning!',
  html: '<p>Rise and shine.</p>',
  scheduledAt: new Date('2026-03-12T09:00:00Z'),
});
```

## Retrieving emails

```ts
// List with filtering
const { data, pagination } = await rebel.emails.list({
  status: 'DELIVERED',
  limit: 50,
  tag: 'billing',
});

// Get single email with event timeline
const email = await rebel.emails.get('email_id');
console.log(email.events); // [{ type: 'DELIVERED', timestamp: '...' }, ...]

// Cancel a scheduled email
await rebel.emails.cancel('email_id');
```

## Domains

```ts
// Add a domain
const domain = await rebel.domains.create({ name: 'yourdomain.com' });
console.log(domain.dnsRecords); // DNS records to add

// Check verification
const verified = await rebel.domains.verify(domain.id);

// List all domains
const { data } = await rebel.domains.list();
```

## Webhooks

```ts
// Create a webhook
const { data: webhook } = await rebel.webhooks.create({
  url: 'https://yourapp.com/webhooks/email',
  events: ['DELIVERED', 'BOUNCED', 'OPENED', 'CLICKED'],
});
console.log(webhook.secret); // Save this — shown only once

// List webhooks
const { data: webhooks } = await rebel.webhooks.list();

// Update
await rebel.webhooks.update(webhook.id, { active: false });
```

## Templates

```ts
// Create
const template = await rebel.templates.create({
  name: 'Welcome Email',
  subject: 'Welcome, {{name}}!',
  htmlBody: '<h1>Hey {{name}}</h1><p>Welcome to {{plan}}.</p>',
});

// Update
await rebel.templates.update(template.id, {
  subject: 'Welcome aboard, {{name}}!',
});

// List & delete
const { data } = await rebel.templates.list();
await rebel.templates.delete(template.id);
```

## Suppressions

```ts
// Suppress an address
await rebel.suppressions.add('bounced@example.com');

// Bulk suppress
await rebel.suppressions.addBulk(['a@test.com', 'b@test.com']);

// Check before sending
const { suppressed } = await rebel.suppressions.check('user@gmail.com');

// Remove suppression
await rebel.suppressions.remove('user@gmail.com');
```

## Analytics

```ts
const stats = await rebel.analytics.overview();
// { sent: 12400, delivered: 12380, openRate: 0.42, clickRate: 0.12, ... }

const { data: timeseries } = await rebel.analytics.timeseries({
  from: '2026-03-01',
  to: '2026-03-11',
});
```

## Error handling

The SDK throws typed errors you can catch and handle:

```ts
import {
  RebelSenderError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
} from 'rebelsender';

try {
  await rebel.send({ from: 'bad', to: '', subject: '' });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log('Invalid params:', err.details);
  } else if (err instanceof AuthenticationError) {
    console.log('Bad API key');
  } else if (err instanceof RateLimitError) {
    console.log(`Retry after ${err.retryAfter}s`);
  } else if (err instanceof NotFoundError) {
    console.log('Resource not found');
  } else if (err instanceof RebelSenderError) {
    console.log(`API error ${err.status}: ${err.message}`);
  }
}
```

## API keys

```ts
// Create a new API key
const key = await rebel.apiKeys.create({ name: 'Production' });
console.log(key.key); // Full key — shown only once

// List keys
const { data } = await rebel.apiKeys.list();

// Revoke
await rebel.apiKeys.revoke(key.id);
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- Get your API key at [app.rebelsender.com](https://app.rebelsender.com)

## License

MIT
