# Quick Start

Get up and running with the CodeSandbox SDK in minutes.

## Installation

Install the SDK using npm:

```bash
npm install @codesandbox/sdk
```

## Authentication

Create an API token by visiting [https://codesandbox.io/t/api](https://codesandbox.io/t/api) and clicking "Create API Token".

Set your API token as an environment variable:

```bash
export CSB_API_KEY="your-api-token-here"
```

## Basic Usage

Here's a simple example to create a sandbox and run a command:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

// Initialize the SDK
const sdk = new CodeSandbox(process.env.CSB_API_KEY);

// Create a new sandbox
const sandbox = await sdk.sandboxes.create();
console.log(`Created sandbox: ${sandbox.id}`);

// Connect to the sandbox
const client = await sandbox.connect();

// Run a command
const output = await client.commands.run("echo 'Hello World'");
console.log(output); // Hello World

// Clean up
await client.disconnect();
```

## Browser Usage

For browser environments, use the browser-specific build:

```javascript
import { connectToSandbox } from "@codesandbox/sdk/browser";

const client = await connectToSandbox({
  session: yourSandboxSession,
  getSession: async (id) => {
    // Your session retrieval logic
    return await fetchSession(id);
  }
});

const output = await client.commands.run("ls -la");
console.log(output);
```

## Next Steps

- Learn about [Platform Setup](/guides/getting-started/platform-setup) for Node.js and browser environments
- Understand [Authentication](/guides/getting-started/authentication) in detail
- Explore [Basic Operations](/guides/sdk-usage/basic-operations) for common SDK patterns

## Common Use Cases

The CodeSandbox SDK is perfect for:

- **AI Agents**: Run code safely in isolated environments
- **Code Interpretation**: Execute untrusted user code securely  
- **Development Environments**: Spin up consistent dev environments
- **CI/CD**: Run tests and builds in reproducible containers
- **Educational Platforms**: Provide interactive coding environments
