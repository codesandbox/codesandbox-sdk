# Platform Setup

The CodeSandbox SDK supports both Node.js and browser environments with platform-specific optimizations.

## Node.js Setup

### Requirements

- Node.js 16+ 
- npm or yarn package manager

### Installation

```bash
npm install @codesandbox/sdk
```

### Basic Node.js Usage

```javascript
import { CodeSandbox } from "@codesandbox/sdk";
// or
const { CodeSandbox } = require("@codesandbox/sdk");

const sdk = new CodeSandbox(process.env.CSB_API_KEY);
```

### Node.js-Specific Features

The Node.js build includes additional features:

```javascript
import { connectToSandbox } from "@codesandbox/sdk/node";

const client = await connectToSandbox({
  session: sandboxSession,
  getSession: async (id) => await resumeSandbox(id),
  // Node.js specific: no focus change handling needed
});
```

## Browser Setup

### Installation

```bash
npm install @codesandbox/sdk
```

### Browser Usage

```javascript
import { connectToSandbox, createPreview } from "@codesandbox/sdk/browser";

const client = await connectToSandbox({
  session: sandboxSession,
  getSession: async (id) => await resumeSandbox(id),
  // Browser-specific: automatic reconnection on focus
  onFocusChange: (notify) => {
    const listener = () => notify(document.hasFocus());
    window.addEventListener("visibilitychange", listener);
    return () => window.removeEventListener("visibilitychange", listener);
  }
});
```

### Browser-Specific Features

#### Preview Management

```javascript
import { createPreview } from "@codesandbox/sdk/browser";

const preview = createPreview({
  sandboxId: "your-sandbox-id",
  port: 3000,
  // Preview-specific configuration
});

preview.on("ready", () => {
  console.log("Preview is ready");
});
```

#### Automatic Reconnection

The browser build automatically handles:
- Reconnection when the tab regains focus
- Connection state management during tab switching
- Optimized WebSocket handling for browser environments

## Environment Variables

Both platforms support these environment variables:

```bash
# Required: Your CodeSandbox API token
CSB_API_KEY="your-api-token"

# Optional: Custom API endpoint (for enterprise)
CSB_API_URL="https://api.codesandbox.io"
```

## TypeScript Support

The SDK includes full TypeScript definitions:

```typescript
import { CodeSandbox, SandboxClient, VMTier } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);

// Type-safe sandbox creation
const sandbox = await sdk.sandboxes.create({
  title: "My Sandbox",
  vmTier: VMTier.NANO
});

// Type-safe client usage
const client: SandboxClient = await sandbox.connect();
```

## Build Tools Integration

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "buffer": require.resolve("buffer"),
      "crypto": require.resolve("crypto-browserify"),
      "path": require.resolve("path-browserify"),
      "os": require.resolve("os-browserify/browser")
    }
  }
};
```

### Vite

```javascript
// vite.config.js
export default {
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
};
```

## Next Steps

- Learn about [Authentication](/guides/getting-started/authentication)
- Explore [Basic Operations](/guides/sdk-usage/basic-operations)
- Check out [Browser Integration](/guides/advanced/browser) for advanced browser features
