# Basic Operations

Learn the fundamental operations for working with CodeSandbox sandboxes through the SDK.

## Creating Sandboxes

### Simple Creation

```javascript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);

// Create with minimal configuration
const sandbox = await sdk.sandboxes.create();
console.log(`Created sandbox: ${sandbox.id}`);
```

### Creation with Options

```javascript
const sandbox = await sdk.sandboxes.create({
  title: "My Development Environment",
  privacy: "private", // or "public"
  tags: ["development", "nodejs"],
  vmTier: "SMALL"
});
```

### Creating from Templates

```javascript
// Use a specific template
const sandbox = await sdk.sandboxes.create({
  title: "React App",
  templateId: "react-typescript"
});

// Create from Git repository
const sandbox = await sdk.sandboxes.create({
  title: "GitHub Project",
  source: {
    type: "git",
    url: "https://github.com/user/repo.git",
    branch: "main"
  }
});
```

## Connecting to Sandboxes

### Basic Connection

```javascript
// Connect to a newly created sandbox
const client = await sandbox.connect();

// Or connect to an existing sandbox by ID
const existingSandbox = await sdk.sandboxes.get("sandbox-id");
const client2 = await existingSandbox.connect();
```

### Connection with Monitoring

```javascript
const client = await sandbox.connect();

// Monitor connection state
client.onStateChange((state) => {
  console.log(`Connection state changed to: ${state}`);
});

// Check current state
console.log(`Current state: ${client.state}`);
```

## Listing and Retrieving Sandboxes

### List All Sandboxes

```javascript
const sandboxes = await sdk.sandboxes.list();
console.log(`Found ${sandboxes.length} sandboxes`);

sandboxes.forEach(sandbox => {
  console.log(`${sandbox.title} (${sandbox.id})`);
});
```

### Filtered Listing

```javascript
// Filter by tags
const devSandboxes = await sdk.sandboxes.list({
  tags: ["development"]
});

// Filter by status
const runningSandboxes = await sdk.sandboxes.list({
  status: "running"
});

// Pagination
const page1 = await sdk.sandboxes.list({
  pagination: { page: 1, pageSize: 10 }
});
```

### Efficient Single Retrieval

```javascript
// More efficient than listing and filtering
const sandbox = await sdk.sandboxes.get("specific-sandbox-id");
console.log(sandbox.title, sandbox.tags);
```

## Forking Sandboxes

### Basic Forking

```javascript
// Fork an existing sandbox
const originalSandbox = await sdk.sandboxes.get("original-id");
const forkedSandbox = await sdk.sandboxes.fork(originalSandbox.id);

console.log(`Forked ${originalSandbox.title} to ${forkedSandbox.id}`);
```

### Forking with Customization

```javascript
const forkedSandbox = await sdk.sandboxes.fork("original-id", {
  title: "My Fork of Original",
  privacy: "private"
});
```

## Basic File Operations

### Reading Files

```javascript
const client = await sandbox.connect();

// Read a single file
const packageJson = await client.fs.readFile("/project/package.json");
console.log(JSON.parse(packageJson));

// Check if file exists
const exists = await client.fs.exists("/project/README.md");
if (exists) {
  const readme = await client.fs.readFile("/project/README.md");
  console.log(readme);
}
```

### Writing Files

```javascript
// Write a new file
await client.fs.writeFile("/project/config.json", JSON.stringify({
  environment: "development",
  debug: true
}, null, 2));

// Create a directory and file
await client.fs.createDir("/project/src/components");
await client.fs.writeFile("/project/src/components/Button.tsx", `
import React from 'react';

export const Button = ({ children, onClick }) => (
  <button onClick={onClick}>{children}</button>
);
`);
```

### Directory Operations

```javascript
// List directory contents
const files = await client.fs.readDir("/project");
console.log("Project files:", files);

// Create nested directories
await client.fs.createDir("/project/src/utils", { recursive: true });

// Remove files and directories
await client.fs.deleteFile("/project/temp.txt");
await client.fs.deleteDir("/project/old-folder");
```

## Running Commands

### Simple Command Execution

```javascript
const client = await sandbox.connect();

// Run a simple command
const result = await client.commands.run("ls -la");
console.log(result.output);

// Run with working directory
const result2 = await client.commands.run("npm install", {
  cwd: "/project"
});
```

### Command with Environment Variables

```javascript
const result = await client.commands.run("node app.js", {
  env: {
    NODE_ENV: "development",
    PORT: "3000"
  }
});
```

### Long-Running Commands

```javascript
// Start a development server
const serverProcess = await client.commands.runInteractive("npm run dev", {
  cwd: "/project"
});

// Listen for output
serverProcess.on("data", (data) => {
  console.log("Server output:", data);
});

// Stop the server later
setTimeout(() => {
  serverProcess.kill();
}, 30000);
```

## Managing Sandbox State

### Hibernation

```javascript
// Disconnect client
await client.disconnect();

// Hibernate to save resources
await sandbox.hibernate();
console.log("Sandbox hibernated");

// Resume later
const newClient = await sandbox.connect();
console.log("Sandbox resumed");
```

### Shutdown

```javascript
// Graceful shutdown
await client.disconnect();
await sandbox.shutdown();
console.log("Sandbox shut down permanently");
```

### Keep-Alive

```javascript
const client = await sandbox.connect();

// Prevent automatic hibernation
client.keepActiveWhileConnected(true);

// Your long-running operations here...

// Allow hibernation again
client.keepActiveWhileConnected(false);
```

## Error Handling

### Basic Error Handling

```javascript
try {
  const client = await sandbox.connect();
  const result = await client.commands.run("invalid-command");
} catch (error) {
  console.error("Operation failed:", error.message);
  
  if (error.code === "COMMAND_FAILED") {
    console.error("Command stderr:", error.stderr);
  }
}
```

### Connection Error Handling

```javascript
const client = await sandbox.connect();

client.onStateChange((state) => {
  if (state === "DISCONNECTED") {
    console.log("Connection lost - operations will fail until reconnected");
  }
});

// Robust command execution
async function runCommandSafely(command) {
  try {
    if (client.state === "HIBERNATED") {
      console.log("Reconnecting hibernated sandbox...");
      await client.reconnect();
    }
    
    return await client.commands.run(command);
  } catch (error) {
    if (error.code === "CONNECTION_LOST") {
      console.log("Attempting to reconnect...");
      await client.reconnect();
      return await client.commands.run(command);
    }
    throw error;
  }
}
```

## Resource Cleanup

### Proper Cleanup

```javascript
let client;
try {
  client = await sandbox.connect();
  
  // Your operations here
  await client.commands.run("npm test");
  
} finally {
  // Always clean up
  if (client) {
    await client.disconnect();
    client.dispose();
  }
}
```

### Bulk Cleanup

```javascript
// Clean up multiple sandboxes
const sandboxes = await sdk.sandboxes.list({
  tags: ["temporary"]
});

for (const sandbox of sandboxes) {
  try {
    await sandbox.shutdown();
    console.log(`Cleaned up sandbox: ${sandbox.id}`);
  } catch (error) {
    console.error(`Failed to clean up ${sandbox.id}:`, error.message);
  }
}
```

## Working with Multiple Sandboxes

### Parallel Operations

```javascript
// Create multiple sandboxes in parallel
const sandboxPromises = Array.from({ length: 3 }, (_, i) =>
  sdk.sandboxes.create({
    title: `Test Environment ${i + 1}`,
    tags: ["test", "parallel"]
  })
);

const sandboxes = await Promise.all(sandboxPromises);
console.log(`Created ${sandboxes.length} sandboxes`);

// Connect to all sandboxes
const clients = await Promise.all(
  sandboxes.map(sandbox => sandbox.connect())
);

// Run commands in parallel
const results = await Promise.all(
  clients.map(client => client.commands.run("echo 'Hello from sandbox'"))
);

// Clean up
await Promise.all(clients.map(client => client.disconnect()));
await Promise.all(sandboxes.map(sandbox => sandbox.shutdown()));
```

## Next Steps

- Learn about [File System Operations](/guides/sdk-usage/filesystem) in detail
- Explore [Command Execution](/guides/sdk-usage/commands) patterns
- Check out [Terminal Management](/guides/sdk-usage/terminals)
- See [Use Cases](/guides/use-cases/ai-agents) for real-world examples
