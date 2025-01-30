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

// Create the client with your token
const sdk = new CodeSandbox(token);

// This creates a new sandbox by forking our default template sandbox.
// You can also pass in other template ids, or create your own template to fork from.
const sandbox = await sdk.sandbox.create();

// You can run JS code directly
await sandbox.shells.js.run("console.log(1+1)");
// Or Python code (if it's installed in the template)
await sandbox.shells.python.run("print(1+1)");

// Or anything else
await sandbox.shells.run("echo 'Hello, world!'");

// We have a FS API to interact with the filesystem
await sandbox.fs.writeTextFile("./hello.txt", "world");

// And you can clone sandboxes! This does not only clone the filesystem, processes that are running in the original sandbox will also be cloned!
const sandbox2 = await sandbox.fork();

// Check that the file is still there
await sandbox2.fs.readTextFile("./hello.txt");

// You can also get the opened ports, with the URL to access those
console.log(sandbox2.ports.getOpenedPorts());

// Getting metrics...
const metrics = await sandbox2.getMetrics();
console.log(
  `Memory: ${metrics.memory.usedKiB} KiB / ${metrics.memory.totalKiB} KiB`
);
console.log(`CPU: ${(metrics.cpu.used / metrics.cpu.cores) * 100}%`);

// Finally, you can hibernate a sandbox. This will snapshot the sandbox and stop it. Next time you start the sandbox, it will continue where it left off, as we created a memory snapshot.
await sandbox.hibernate();
await sandbox2.hibernate();

// Open the sandbox again
const resumedSandbox = await sdk.sandbox.open(sandbox.id);
```

## CodeSandbox Integration

This SDK uses the API token from your workspace in CodeSandbox to authenticate and create sandboxes. Because of this, the sandboxes will be created inside your workspace, and the resources will be billed to your workspace.

You could, for example, create a private template in your workspace that has all the dependencies you need (even running servers), and then use that template to fork sandboxes from. This way, you can control the environment that the sandboxes run in.

## Example Use Cases

These are some example use cases that you could use this library for:

Code interpretation: Run code in a sandbox to interpret it. This way, you can run untrusted code without worrying about it affecting your system.

Development environments: Create a sandbox for each developer, and run their code in the sandbox. This way, you can run multiple development environments in parallel without them interfering with each other.

AI Agents: Create a sandbox for each AI agent, and run the agent in the sandbox. This way, you can run multiple agents in parallel without them interfering with each other. Using the forking mechanism, you can also A/B test different agents.

CI/CD: Run tests inside a sandbox, and hibernate the sandbox when the tests are done. This way, you can quickly start the sandbox again when you need to run the tests again or evaluate the results.
