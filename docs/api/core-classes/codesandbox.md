# CodeSandbox

The main entry point for the CodeSandbox SDK. This class provides access to sandbox management and host token operations.

## Constructor

### `new CodeSandbox(apiToken?, opts?)`

Creates a new CodeSandbox SDK instance.

**Parameters:**
- `apiToken` (string, optional) - Your CodeSandbox API token. If not provided, will use `CSB_API_KEY` environment variable
- `opts` (ClientOpts, optional) - Configuration options

**Example:**
```javascript
import { CodeSandbox } from "@codesandbox/sdk";

// Using environment variable
const sdk = new CodeSandbox();

// Using explicit token
const sdk = new CodeSandbox("csb_your_token_here");

// With options
const sdk = new CodeSandbox(process.env.CSB_API_KEY, {
  apiUrl: "https://api.codesandbox.io",
  tracer: myTracer
});
```

## Properties

### `sandboxes`

**Type:** [`Sandboxes`](/api/core-classes/sandboxes)

Provides access to sandbox management operations including creating, listing, getting, and forking sandboxes.

**Example:**
```javascript
const sdk = new CodeSandbox();

// Create a new sandbox
const sandbox = await sdk.sandboxes.create();

// List existing sandboxes
const sandboxes = await sdk.sandboxes.list();

// Get a specific sandbox
const sandbox = await sdk.sandboxes.get("sandbox-id");
```

### `hosts`

**Type:** [`HostTokens`](/api/host-tokens/host-tokens)

Provides access to host token management for generating signed URLs and headers for private sandboxes.

**Example:**
```javascript
const sdk = new CodeSandbox();

// Create a host token
const hostToken = await sdk.hosts.create("sandbox-id", {
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
});

// List host tokens
const tokens = await sdk.hosts.list("sandbox-id");
```

## Configuration Options

### `ClientOpts`

Configuration options for the CodeSandbox SDK.

**Properties:**
- `apiUrl` (string, optional) - Custom API endpoint URL. Defaults to `https://api.codesandbox.io`
- `tracer` (Tracer, optional) - OpenTelemetry tracer for observability
- `timeout` (number, optional) - Request timeout in milliseconds

**Example:**
```javascript
const sdk = new CodeSandbox(process.env.CSB_API_KEY, {
  apiUrl: "https://your-enterprise.codesandbox.io/api",
  timeout: 30000, // 30 seconds
  tracer: myOpenTelemetryTracer
});
```

## Environment Variables

The SDK automatically detects these environment variables:

### `CSB_API_KEY`

Your CodeSandbox API token. Used automatically if no token is provided to the constructor.

```bash
export CSB_API_KEY="csb_your_token_here"
```

### `CSB_API_URL`

Custom API endpoint URL for enterprise installations.

```bash
export CSB_API_URL="https://your-enterprise.codesandbox.io/api"
```

## Error Handling

The CodeSandbox class will throw errors for:

- **Invalid API token** - 401 Unauthorized
- **Insufficient permissions** - 403 Forbidden  
- **Network issues** - Connection timeouts, DNS failures
- **API errors** - Server errors, rate limiting

**Example:**
```javascript
try {
  const sdk = new CodeSandbox("invalid-token");
  const sandbox = await sdk.sandboxes.create();
} catch (error) {
  if (error.status === 401) {
    console.error("Invalid API token");
  } else if (error.status === 403) {
    console.error("Insufficient permissions");
  } else {
    console.error("API error:", error.message);
  }
}
```

## Usage Patterns

### Basic Usage

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);

// Create and connect to a sandbox
const sandbox = await sdk.sandboxes.create({
  title: "My Development Environment"
});

const client = await sandbox.connect();

// Use the sandbox
const result = await client.commands.run("echo 'Hello World'");
console.log(result.output);

// Clean up
await client.disconnect();
await sandbox.shutdown();
```

### Enterprise Usage

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY, {
  apiUrl: "https://your-company.codesandbox.io/api",
  timeout: 60000 // Longer timeout for enterprise
});
```

### With Observability

```javascript
import { CodeSandbox } from "@codesandbox/sdk";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("my-app");

const sdk = new CodeSandbox(process.env.CSB_API_KEY, {
  tracer: tracer
});

// All SDK operations will be traced
const sandbox = await sdk.sandboxes.create();
```

## TypeScript Support

The CodeSandbox class is fully typed:

```typescript
import { CodeSandbox, ClientOpts, Sandbox } from "@codesandbox/sdk";

const opts: ClientOpts = {
  apiUrl: "https://api.codesandbox.io",
  timeout: 30000
};

const sdk: CodeSandbox = new CodeSandbox(process.env.CSB_API_KEY, opts);
const sandbox: Sandbox = await sdk.sandboxes.create();
```

## Related

- [`Sandboxes`](/api/core-classes/sandboxes) - Sandbox management operations
- [`HostTokens`](/api/host-tokens/host-tokens) - Host token management
- [Quick Start Guide](/guides/getting-started/quick-start) - Getting started tutorial
- [Authentication](/guides/getting-started/authentication) - Authentication setup
