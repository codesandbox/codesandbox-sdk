import { CodeSandbox } from "../../src/index.js";

/**
 * Test template ID used across e2e tests
 */
export const TEST_TEMPLATE_ID =
  process.env.CSB_TEST_TEMPLATE_ID ?? "pt_FXCz5KGvDQsafzZz7awrSe";

/**
 * Initialize SDK with API key from environment
 */
export function initializeSDK(): CodeSandbox {
  if (process.env.CSB_BASE_URL) {
    return new CodeSandbox(process.env.CSB_API_KEY, {
      baseUrl: process.env.CSB_BASE_URL,
    });
  }

  return new CodeSandbox(process.env.CSB_API_KEY);
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
