# CodeSandbox SDK

> The power of CodeSandbox in a library

CodeSandbox SDK enables you to programmatically spin up development environments and run untrusted code. It provides a programmatic API to create and run sandboxes quickly and securely.

Under the hood, the SDK uses the microVM infrastructure of CodeSandbox to spin up sandboxes. It supports:

- Snapshotting/restoring VMs (checkpointing) at any point in time
  - With snapshot restore times within 1 second
- Cloning VMs & Snapshots within 2 seconds
- Source control (git, GitHub, CodeSandbox SCM)
- Running any Dockerfile

Check out the [CodeSandbox SDK documentation](https://codesandbox.io/docs/sdk) for more information.

## Getting Started

To get started, install the SDK:

```bash
npm install @codesandbox/sdk
```

Create an API token by going to https://codesandbox.io/t/api, and clicking on the "Create API Token" button. You can then use this token to authenticate with the SDK:

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);
const sandbox = await sdk.sandboxes.create();
const client = await sandbox.connect();

const output = await client.commands.run("echo 'Hello World'");

console.log(output); // Hello World
```

## Configuration

The SDK supports the following environment variables for configuration:

- `CSB_API_KEY`: Your CodeSandbox API token for authentication

## CodeSandbox Integration

This SDK uses the API token from your workspace in CodeSandbox to authenticate and create sandboxes. Because of this, the sandboxes will be created inside your workspace, and the resources will be billed to your workspace.

Build your own template that has all the dependencies you need (even running servers), and then use that template to create sandboxes from. This way, you can control the environment that the sandboxes run in.

## Example Use Cases

These are some example use cases that you could use this library for:

Code interpretation: Run code in a sandbox to interpret it. This way, you can run untrusted code without worrying about it affecting your system.

Development environments: Create a sandbox for each developer, and run their code in the sandbox. This way, you can run multiple development environments in parallel without them interfering with each other.

AI Agents: Create a sandbox for each AI agent, and run the agent in the sandbox. This way, you can run multiple agents in parallel without them interfering with each other.

CI/CD: Run tests inside a sandbox, and hibernate the sandbox when the tests are done. This way, you can quickly start the sandbox again when you need to run the tests again or evaluate the results.
