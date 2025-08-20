# CLI Overview

The CodeSandbox SDK includes a powerful command-line interface (CLI) for managing sandboxes, building projects, and working with host tokens.

## Installation

The CLI is included when you install the SDK:

```bash
npm install -g @codesandbox/sdk
```

Or use it locally in your project:

```bash
npm install @codesandbox/sdk
npx csb --help
```

## Authentication

Set your API token as an environment variable:

```bash
export CSB_API_KEY="your-api-token-here"
```

Or create a `.env` file:

```bash
# .env
CSB_API_KEY=your-api-token-here
```

## Interactive Mode

Run `csb` without any arguments to enter interactive mode:

```bash
csb
```

This launches a full-screen dashboard where you can:

- **View running sandboxes** with real-time status
- **Navigate between sandboxes** using arrow keys
- **Connect to sandbox terminals** directly
- **Monitor resource usage** and performance
- **Manage sandbox lifecycle** (hibernate, shutdown)

### Interactive Mode Features

- **Real-time updates** - Sandbox status updates automatically
- **Keyboard shortcuts** - Efficient navigation and control
- **Terminal integration** - Direct access to sandbox terminals
- **Resource monitoring** - CPU, memory, and storage usage
- **Bulk operations** - Select and manage multiple sandboxes

## Command-Line Mode

Use specific commands for automation and scripting:

```bash
csb <command> [options]
```

## Available Commands

### Sandbox Management

```bash
# List all sandboxes
csb sandboxes list

# List with filtering
csb sandboxes list --tags development --status running

# Fork a sandbox
csb sandboxes fork <sandbox-id>

# Hibernate sandboxes
csb sandboxes hibernate <sandbox-id>
csb sandboxes hibernate < sandbox-ids.txt  # Bulk hibernation

# Shutdown sandboxes
csb sandboxes shutdown <sandbox-id>
csb sandboxes shutdown < sandbox-ids.txt   # Bulk shutdown
```

### Project Building

```bash
# Build and deploy current directory
csb build .

# Build with custom name and VM tier
csb build . --name "My App" --vm-tier SMALL

# Build for CI/CD
csb build . --ci --log-path ./build.log
```

### Host Token Management

```bash
# List host tokens for a sandbox
csb host-tokens list <sandbox-id>

# Create a host token
csb host-tokens create <sandbox-id> --expires-at 2024-12-31T23:59:59Z

# Update token expiration
csb host-tokens update <sandbox-id> <token-id> --expires-at 2024-12-31T23:59:59Z

# Revoke a specific token
csb host-tokens revoke <sandbox-id> <token-id>

# Revoke all tokens
csb host-tokens revoke <sandbox-id> --all
```

## Global Options

All commands support these global options:

- `--help` - Show command help
- `--version` - Show CLI version
- `--api-key <token>` - Override API token
- `--api-url <url>` - Custom API endpoint (for enterprise)

## Output Formats

### JSON Output

Most commands support JSON output for scripting:

```bash
csb sandboxes list --output json | jq '.[] | .id'
```

### Custom Fields

Specify which fields to display:

```bash
csb sandboxes list --output id,title,status,createdAt
```

### No Headers

Remove headers for cleaner output:

```bash
csb sandboxes list --no-headers
```

## Scripting and Automation

### Bash Integration

```bash
#!/bin/bash

# Get all running sandbox IDs
RUNNING_SANDBOXES=$(csb sandboxes list --status running --output id --no-headers)

# Hibernate all running sandboxes
echo "$RUNNING_SANDBOXES" | csb sandboxes hibernate
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Build and deploy
  run: |
    csb build . --ci --name "PR-${{ github.event.number }}"
  env:
    CSB_API_KEY: ${{ secrets.CSB_API_KEY }}
```

### Bulk Operations

```bash
# Create a list of sandbox IDs to process
csb sandboxes list --tags "cleanup" --output id --no-headers > cleanup-list.txt

# Shutdown all sandboxes in the list
csb sandboxes shutdown < cleanup-list.txt
```

## Configuration

### Environment Variables

- `CSB_API_KEY` - Your CodeSandbox API token
- `CSB_API_URL` - Custom API endpoint (enterprise)
- `CSB_DEFAULT_VM_TIER` - Default VM tier for new sandboxes

### Config File

Create a `.csbrc` file in your home directory:

```json
{
  "apiUrl": "https://your-enterprise.codesandbox.io/api",
  "defaultVmTier": "SMALL",
  "timeout": 30000
}
```

## Error Handling

The CLI provides detailed error messages and exit codes:

```bash
csb sandboxes list
echo $?  # 0 for success, non-zero for errors
```

Common exit codes:
- `0` - Success
- `1` - General error
- `2` - Authentication error
- `3` - Network error
- `4` - Resource not found

## Debugging

Enable debug output:

```bash
DEBUG=csb:* csb sandboxes list
```

Or for specific components:

```bash
DEBUG=csb:api csb sandboxes create
```

## Examples

### Development Workflow

```bash
# Create a development sandbox
csb build . --name "Feature Branch" --tags development

# List development sandboxes
csb sandboxes list --tags development

# Clean up old development sandboxes
csb sandboxes list --tags development --since "7 days ago" --output id --no-headers | \
  csb sandboxes shutdown
```

### Production Deployment

```bash
# Build for production
csb build . --name "Production v1.2.3" --vm-tier LARGE --ci

# Create host tokens for external access
csb host-tokens create $SANDBOX_ID --expires-at "2024-12-31T23:59:59Z"
```

### Monitoring and Maintenance

```bash
# Check running sandboxes
csb sandboxes list --status running

# Hibernate idle sandboxes (older than 1 hour)
csb sandboxes list --status running --since "1 hour ago" --output id --no-headers | \
  csb sandboxes hibernate
```

## Next Steps

- Learn about [Interactive Mode](/cli/interactive) in detail
- Explore [Build Command](/cli/build) options
- Check out [Sandbox Management](/cli/sandboxes) commands
- See [Host Token Management](/cli/host-tokens) for access control
