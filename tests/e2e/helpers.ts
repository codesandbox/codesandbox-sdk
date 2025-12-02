import { CodeSandbox } from "../../src/index.js";

/**
 * Test template ID used across e2e tests
 */
export const TEST_TEMPLATE_ID = process.env.CSB_TEST_TEMPLATE_ID ?? "";

/**
 * Initialize SDK with API key from environment
 */
export function initializeSDK(): CodeSandbox {
  return new CodeSandbox("csb_v1_devbox", {
    baseUrl: "http://codesandbox.dev",
  });
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
