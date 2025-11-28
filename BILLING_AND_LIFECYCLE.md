# Billing and Sandbox Lifecycle Management

This document provides comprehensive information about CodeSandbox SDK billing, sandbox states, and lifecycle management to help you optimize costs and manage resources effectively.

## Billing Overview

### How Billing Works

CodeSandbox SDK billing is based on **VM Credits** and **Runtime Hours**:
- **VM Credits**: $0.01486 per credit
- **Runtime Hours**: Different VM sizes consume different amounts of credits per hour
- **Billing starts** when a sandbox starts/resumes and **stops** when properly shut down or hibernated

### VM Size Pricing Examples
- **Pico**: 5 credits/hour ($0.0743) - 2 cores, 1 GB RAM
- **Nano**: 10 credits/hour ($0.1486) - 2 cores, 4 GB RAM  
- **Micro**: 20 credits/hour ($0.2972) - 4 cores, 8 GB RAM
- **Large**: 160 credits/hour ($2.3776) - 32 cores, 64 GB RAM

## Sandbox States and Lifecycle

### Sandbox States

1. **RUNNING**: Active sandbox consuming credits
2. **HIBERNATED**: Suspended sandbox with memory snapshot saved - **NO BILLING**
3. **SHUTDOWN**: Stopped sandbox with no memory state - **NO BILLING**  
4. **DISCONNECTED**: Temporary disconnection state

### Hibernation vs Shutdown

| State | Billing | Resume Time | Memory State | Use Case |
|-------|---------|-------------|--------------|----------|
| **Hibernated** | ❌ No billing | 1-2 seconds | Preserved | Short breaks, temporary pauses |
| **Shutdown** | ❌ No billing | 3-5 seconds (cold start) | Lost | Long-term storage, cost optimization |

### Automatic Hibernation

Sandboxes automatically hibernate after **5 minutes of inactivity** by default (configurable up to 24 hours).

## Managing Sandbox Lifecycle

### 1. Proper Shutdown to Stop Billing

```typescript
import { CodeSandbox } from "@codesandbox/sdk";

const sdk = new CodeSandbox(process.env.CSB_API_KEY);

// Resume a sandbox
const sandbox = await sdk.sandboxes.resume('sandbox-id');

// Properly shutdown to stop billing immediately
await sdk.sandboxes.shutdown(sandbox.id);
console.log('✅ Billing stopped - sandbox shutdown');
```

### 2. Hibernation for Temporary Pauses

```typescript
// Hibernate for temporary pause (faster resume)
await sdk.sandboxes.hibernate(sandbox.id);
console.log('✅ Billing paused - sandbox hibernated');

// Resume from hibernation (1-2 seconds)
const resumedSandbox = await sdk.sandboxes.resume(sandbox.id);
```

### 3. Managing Multiple Sandboxes

```typescript
// List all running VMs to see what's consuming credits
const runningInfo = await sdk.sandboxes.listRunning();
console.log(`Running VMs: ${runningInfo.concurrentVmCount}/${runningInfo.concurrentVmLimit}`);

// Show VMs with runtime details
runningInfo.vms.forEach(vm => {
  const runtime = vm.sessionStartedAt 
    ? Date.now() - vm.sessionStartedAt.getTime() 
    : 0;
  const hours = Math.round(runtime / (1000 * 60 * 60) * 100) / 100;
  
  console.log(`VM ${vm.id}: ${hours}h runtime, Credits: ${vm.creditBasis}/hour`);
});
```

### 4. Batch Operations for Cost Control

```typescript
// Shutdown multiple sandboxes in parallel
async function shutdownMultipleSandboxes(sandboxIds: string[]) {
  const shutdownPromises = sandboxIds.map(id => 
    sdk.sandboxes.shutdown(id).catch(err => 
      console.error(`Failed to shutdown ${id}:`, err)
    )
  );
  
  await Promise.all(shutdownPromises);
  console.log(`✅ Attempted shutdown of ${sandboxIds.length} sandboxes`);
}

// Hibernate inactive sandboxes
async function hibernateInactiveSandboxes(inactivityThreshold: number = 60 * 60 * 1000) {
  const running = await sdk.sandboxes.listRunning();
  const now = Date.now();
  
  const inactiveVms = running.vms.filter(vm => {
    if (!vm.lastActiveAt) return false;
    return (now - vm.lastActiveAt.getTime()) > inactivityThreshold;
  });
  
  const hibernatePromises = inactiveVms.map(vm =>
    sdk.sandboxes.hibernate(vm.id).catch(err => 
      console.error(`Failed to hibernate ${vm.id}:`, err)
    )
  );
  
  await Promise.all(hibernatePromises);
  console.log(`✅ Hibernated ${inactiveVms.length} inactive sandboxes`);
}
```

## Best Practices for Cost Management

### 1. Monitor Running VMs Regularly

```typescript
// Set up periodic monitoring
async function monitorSandboxes() {
  const running = await sdk.sandboxes.listRunning();
  const totalCreditsPerHour = running.vms.reduce((sum, vm) => sum + vm.creditBasis, 0);
  const estimatedHourlyCost = totalCreditsPerHour * 0.01486;
  
  console.log(`💰 Current hourly cost: $${estimatedHourlyCost.toFixed(4)}`);
  console.log(`📊 Running VMs: ${running.concurrentVmCount}`);
  
  // Alert if costs are high
  if (estimatedHourlyCost > 5.00) {
    console.warn('⚠️  High costs detected! Consider hibernating unused sandboxes');
  }
}

// Run every 15 minutes
setInterval(monitorSandboxes, 15 * 60 * 1000);
```

### 2. Implement Automatic Cleanup

```typescript
// Automatic cleanup based on usage patterns
async function autoCleanup() {
  const running = await sdk.sandboxes.listRunning();
  const now = Date.now();
  
  for (const vm of running.vms) {
    const sessionHours = vm.sessionStartedAt 
      ? (now - vm.sessionStartedAt.getTime()) / (1000 * 60 * 60)
      : 0;
    
    const inactiveHours = vm.lastActiveAt 
      ? (now - vm.lastActiveAt.getTime()) / (1000 * 60 * 60)
      : sessionHours;
    
    // Shutdown sandboxes running >24h with >2h inactivity
    if (sessionHours > 24 && inactiveHours > 2) {
      await sdk.sandboxes.shutdown(vm.id);
      console.log(`🛑 Auto-shutdown: ${vm.id} (${sessionHours.toFixed(1)}h runtime, ${inactiveHours.toFixed(1)}h inactive)`);
    }
    // Hibernate sandboxes inactive >1h
    else if (inactiveHours > 1) {
      await sdk.sandboxes.hibernate(vm.id);
      console.log(`😴 Auto-hibernate: ${vm.id} (${inactiveHours.toFixed(1)}h inactive)`);
    }
  }
}
```

### 3. Configure Hibernation Timeout

```typescript
// Create sandbox with custom hibernation timeout (max 24 hours)
const sandbox = await sdk.sandboxes.create({
  // Hibernate after 10 minutes of inactivity instead of default 5 minutes
  hibernationTimeoutSeconds: 600, // 10 minutes
  
  // Other options...
  title: "My Sandbox",
  tags: ["production", "api-server"]
});
```

## Frequently Asked Questions

### Q: How is billing calculated?
**A**: Billing is calculated based on VM runtime hours × credits per hour × $0.01486 per credit. Billing starts when a sandbox starts/resumes and stops when properly shut down or hibernated.

### Q: What is dormancy/hibernation?
**A**: Hibernation is a suspended state where the VM's memory is saved to disk. Hibernated sandboxes do **not** consume credits (no billing). Default hibernation happens after 5 minutes of inactivity.

### Q: Does billing continue after hibernation?
**A**: **No**. Hibernated sandboxes stop billing immediately. Only running/active sandboxes consume credits.

### Q: Will `sdk.sandboxes.shutdown()` stop billing?
**A**: **Yes**. Calling `shutdown()` immediately stops the sandbox and billing. This is the recommended way to stop billing when you're done with a sandbox.

### Q: How do I identify long-running sandboxes?
**A**: Use `sdk.sandboxes.listRunning()` to see all active VMs with their `sessionStartedAt` times and calculate runtime hours.

### Q: What's the difference between hibernation and shutdown for billing?
**A**: Both stop billing immediately. Hibernation preserves memory state for faster resume (~1-2s), while shutdown requires a cold start (~3-5s) but completely frees resources.

## Error Handling

```typescript
// Robust shutdown with error handling
async function safeShutdown(sandboxId: string) {
  try {
    await sdk.sandboxes.shutdown(sandboxId);
    console.log(`✅ Successfully shutdown ${sandboxId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to shutdown ${sandboxId}:`, error);
    
    // Try hibernation as fallback
    try {
      await sdk.sandboxes.hibernate(sandboxId);
      console.log(`✅ Successfully hibernated ${sandboxId} as fallback`);
      return true;
    } catch (hibernateError) {
      console.error(`❌ Failed to hibernate ${sandboxId}:`, hibernateError);
      return false;
    }
  }
}
```

## Integration with CI/CD

```typescript
// Example: Cleanup after tests
process.on('exit', async () => {
  if (process.env.TEST_SANDBOX_ID) {
    await sdk.sandboxes.shutdown(process.env.TEST_SANDBOX_ID);
    console.log('🧹 Test sandbox cleaned up on exit');
  }
});

// Example: GitHub Actions cleanup
if (process.env.GITHUB_ACTIONS) {
  process.on('SIGTERM', async () => {
    const running = await sdk.sandboxes.listRunning();
    const ciSandboxes = running.vms.filter(vm => 
      // Assuming CI sandboxes have specific tags
      vm.id.includes('ci-') || vm.id.includes('test-')
    );
    
    await Promise.all(
      ciSandboxes.map(vm => sdk.sandboxes.shutdown(vm.id))
    );
  });
}
```

---

💡 **Pro Tip**: Always call `shutdown()` or `hibernate()` when finished with a sandbox to avoid unexpected charges. Monitor your running VMs regularly using `listRunning()` to keep costs under control.