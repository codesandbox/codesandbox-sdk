import { CodeSandbox, Sandbox } from "../../src/index.js";

/**
 * Test template ID used across e2e tests
 */
export const TEST_TEMPLATE_ID = process.env.CSB_TEST_TEMPLATE_ID;

if (!TEST_TEMPLATE_ID) {
  throw new Error("You have to provide a test template id");
}

/**
 * Initialize SDK with API key from environment
 */
export function initializeSDK(): CodeSandbox {
  if (process.env.CSB_BASE_URL) {
    return new CodeSandbox(process.env.CSB_API_KEY, {
      baseUrl: process.env.CSB_BASE_URL,
    });
  }

  console.warn("No CSB_BASE_URL provided, defaulting to PRODUCTION");

  return new CodeSandbox(process.env.CSB_API_KEY, {
    baseUrl: "https://api.codesandbox.io",
  });
}

export async function createSandbox(sdk: CodeSandbox) {
  const templateId = TEST_TEMPLATE_ID!;
  const tags = ["sdk"];
  let path = "/e2e-tests";

  const sandbox = await sdk.sandboxes["api"].forkSandbox(templateId, {
    privacy: 2,
    tags,
    path,
    private_preview: false,
  });

  const startResponse = await sdk.sandboxes["api"].startVm(
    sandbox.id,
    { retryDelay: 200 } // Keep 200ms delay for creation
  );

  return new Sandbox(sandbox.id, sdk.sandboxes["api"], startResponse);
}

/**
 * Retry a check function until it returns truthy or timeout is reached
 */
export async function retryUntil<T>(
  timeoutMs: number,
  intervalMs: number,
  checkFunction: () => Promise<T | null | undefined | false>
): Promise<T | null> {
  const startTime = Date.now();
  let result: T | null | undefined | false = false;

  while (Date.now() - startTime < timeoutMs && !result) {
    result = await checkFunction();
    if (!result) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return result || null;
}
