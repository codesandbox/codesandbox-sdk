# Understanding Sandboxes

Learn about CodeSandbox microVMs and how they provide secure, isolated environments for code execution.

## What are CodeSandbox Sandboxes?

CodeSandbox sandboxes are lightweight microVMs that provide:

- **Isolated environments** for running untrusted code safely
- **Full Linux environments** with complete file system access
- **Persistent storage** that survives hibernation
- **Network access** with configurable port forwarding
- **Snapshotting capabilities** for instant environment restoration

## Sandbox Architecture

### MicroVM Infrastructure

Each sandbox runs in its own microVM with:

```
┌─────────────────────────────────────┐
│            Sandbox (microVM)        │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐   │
│  │ File System │  │   Network   │   │
│  │             │  │   Stack     │   │
│  └─────────────┘  └─────────────┘   │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐   │
│  │  Terminals  │  │  Processes  │   │
│  │             │  │             │   │
│  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────┘
```

### Resource Isolation

- **CPU**: Dedicated CPU allocation based on VM tier
- **Memory**: Isolated memory space (512MB to 32GB)
- **Storage**: Persistent disk storage (up to 20GB)
- **Network**: Isolated network namespace with port forwarding

## Sandbox States

Sandboxes have several states throughout their lifecycle:

### Creating
The sandbox is being provisioned and initialized.

```javascript
const sandbox = await sdk.sandboxes.create();
// Sandbox is in "creating" state
```

### Running
The sandbox is active and ready for connections.

```javascript
const client = await sandbox.connect();
// Sandbox is now "running"
```

### Hibernated
The sandbox is paused to save resources but maintains state.

```javascript
await sandbox.hibernate();
// Sandbox is "hibernated" - can be resumed quickly
```

### Shutdown
The sandbox is completely stopped and resources are freed.

```javascript
await sandbox.shutdown();
// Sandbox is "shutdown" - cannot be resumed
```

## Sandbox Properties

### Basic Information

```javascript
const sandbox = await sdk.sandboxes.get("sandbox-id");

console.log({
  id: sandbox.id,
  title: sandbox.title,
  privacy: sandbox.privacy, // "public" or "private"
  tags: sandbox.tags,
  createdAt: sandbox.createdAt,
  updatedAt: sandbox.updatedAt
});
```

### Runtime Information

```javascript
const client = await sandbox.connect();

console.log({
  state: client.state, // "CONNECTED", "DISCONNECTED", "HIBERNATED"
  workspacePath: client.workspacePath, // "/project"
  editorUrl: client.editorUrl, // Browser editor URL
  isUpToDate: client.isUpToDate // Agent version status
});
```

## Sandbox Templates

### Using Default Templates

```javascript
// Create from default Node.js template
const sandbox = await sdk.sandboxes.create({
  title: "My Node.js App"
});
```

### Using Custom Templates

```javascript
// Create from your custom template
const sandbox = await sdk.sandboxes.create({
  title: "My Custom App",
  templateId: "your-template-id"
});
```

### Creating from Git Repositories

```javascript
const sandbox = await sdk.sandboxes.create({
  title: "GitHub Project",
  source: {
    type: "git",
    url: "https://github.com/user/repo.git",
    branch: "main"
  }
});
```

## Sandbox Networking

### Port Management

Sandboxes can expose services on various ports:

```javascript
const client = await sandbox.connect();

// List open ports
const ports = await client.ports.list();

// Get preview URL for a port
const previewUrl = await client.ports.getPreviewUrl(3000);
console.log(`App running at: ${previewUrl}`);
```

### Preview URLs

Preview URLs allow external access to sandbox services:

- **Public sandboxes**: Direct preview URLs
- **Private sandboxes**: Require host tokens for access

## Sandbox Persistence

### File System Persistence

Files written to the sandbox persist across hibernation:

```javascript
const client = await sandbox.connect();

// Write a file
await client.fs.writeFile("/project/data.txt", "Hello World");

// Hibernate the sandbox
await client.disconnect();
await sandbox.hibernate();

// Resume and read the file
const newClient = await sandbox.connect();
const content = await newClient.fs.readFile("/project/data.txt");
console.log(content); // "Hello World"
```

### Process State

Running processes are paused during hibernation and resumed when the sandbox wakes up.

## Sandbox Limits

### Resource Limits

Different VM tiers have different limits:

| Tier | CPU | Memory | Storage | Network |
|------|-----|--------|---------|---------|
| Nano | 0.5 vCPU | 512MB | 5GB | 1Gbps |
| Micro | 1 vCPU | 2GB | 10GB | 1Gbps |
| Small | 2 vCPU | 4GB | 20GB | 1Gbps |
| Medium | 4 vCPU | 8GB | 20GB | 1Gbps |
| Large | 8 vCPU | 16GB | 20GB | 1Gbps |
| XLarge | 16 vCPU | 32GB | 20GB | 1Gbps |

### Usage Limits

- **Concurrent sandboxes**: Based on your workspace plan
- **Monthly usage**: CPU-hours and storage limits
- **Hibernation timeout**: Automatic hibernation after inactivity

## Security Model

### Isolation Guarantees

- **Process isolation**: Sandboxes cannot access each other
- **Network isolation**: Controlled network access
- **File system isolation**: Separate file systems per sandbox
- **Resource isolation**: CPU and memory limits enforced

### Safe Code Execution

Perfect for running untrusted code:

```javascript
const client = await sandbox.connect();

// Safely execute user-provided code
const result = await client.commands.run(`
  python3 -c "
    import sys
    print('User code executed safely')
    print(f'Python version: {sys.version}')
  "
`);

console.log(result.output);
```

## Next Steps

- Learn about [Sandbox Lifecycle](/guides/core-concepts/lifecycle)
- Understand [VM Tiers & Resources](/guides/core-concepts/vm-tiers)
- Explore [Basic Operations](/guides/sdk-usage/basic-operations)
