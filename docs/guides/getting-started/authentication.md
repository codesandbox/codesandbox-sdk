# Authentication

Learn how to authenticate with the CodeSandbox SDK and manage API tokens securely.

## API Token Creation

1. Visit [https://codesandbox.io/t/api](https://codesandbox.io/t/api)
2. Click "Create API Token"
3. Give your token a descriptive name
4. Copy the generated token (you won't be able to see it again)

## Setting Up Authentication

### Environment Variables (Recommended)

Set your API token as an environment variable:

```bash
export CSB_API_KEY="csb_your_token_here"
```

The SDK will automatically detect and use this token:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

// Automatically uses CSB_API_KEY environment variable
const sdk = new CodeSandbox();
```

### Direct Token Passing

You can also pass the token directly:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox("csb_your_token_here");
```

### Configuration File

For development, you can use a `.env` file:

```bash
# .env
CSB_API_KEY=csb_your_token_here
```

Then load it in your application:

```javascript
import dotenv from 'dotenv';
dotenv.config();

import { CodeSandbox } from "@codesandbox/sdk";
const sdk = new CodeSandbox(); // Uses process.env.CSB_API_KEY
```

## Token Security

### Best Practices

- **Never commit tokens to version control**
- **Use environment variables in production**
- **Rotate tokens regularly**
- **Use different tokens for different environments**

### Token Scopes

API tokens have access to:
- Create and manage sandboxes in your workspace
- Access private sandboxes
- Generate host tokens for preview URLs
- All sandbox operations (files, commands, terminals, etc.)

## Workspace Integration

Your API token is tied to your CodeSandbox workspace:

- **Billing**: All sandbox usage is billed to your workspace
- **Resources**: Sandboxes count against your workspace limits
- **Privacy**: Private sandboxes remain private to your workspace
- **Templates**: You can use your workspace templates

## Host Tokens

For accessing private sandboxes from external applications, you'll need host tokens:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);

// Create a host token for a private sandbox
const hostToken = await sdk.hosts.create("sandbox-id", {
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
});

// Use the host token to access the sandbox
const previewUrl = `https://codesandbox.io/p/devbox/${sandboxId}?token=${hostToken.token}`;
```

## Error Handling

Handle authentication errors gracefully:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

try {
  const sdk = new CodeSandbox(process.env.CSB_API_KEY);
  const sandbox = await sdk.sandboxes.create();
} catch (error) {
  if (error.status === 401) {
    console.error("Invalid API token. Please check your CSB_API_KEY");
  } else if (error.status === 403) {
    console.error("Insufficient permissions. Check your workspace access");
  } else {
    console.error("Authentication error:", error.message);
  }
}
```

## Token Management

### Listing Active Tokens

Currently, token management is done through the CodeSandbox dashboard at [https://codesandbox.io/t/api](https://codesandbox.io/t/api).

### Revoking Tokens

To revoke a token:
1. Go to [https://codesandbox.io/t/api](https://codesandbox.io/t/api)
2. Find the token you want to revoke
3. Click "Revoke"

### Token Rotation

For security, regularly rotate your API tokens:

1. Create a new token
2. Update your environment variables
3. Test the new token
4. Revoke the old token

## Enterprise Authentication

For CodeSandbox Enterprise customers:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY, {
  apiUrl: "https://your-enterprise-domain.codesandbox.io/api"
});
```

## Next Steps

- Learn about [Understanding Sandboxes](/guides/core-concepts/sandboxes)
- Explore [Basic Operations](/guides/sdk-usage/basic-operations)
- Check out [Host Tokens](/api/host-tokens/host-tokens) for advanced access control
