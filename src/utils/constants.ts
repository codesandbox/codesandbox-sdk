/* eslint-disable no-console */

function ensure<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function getInferredBaseUrl(token: string) {
  if (process.env.CSB_BASE_URL) {
    return process.env.CSB_BASE_URL;
  }

  if (token.startsWith("csb_")) {
    return "https://api.codesandbox.io";
  }

  return "https://api.together.ai/csb/sdk";
}

export function getInferredApiKey() {
  return ensure(
    typeof process !== "undefined"
      ? process.env?.CSB_API_KEY || process.env?.TOGETHER_API_KEY
      : undefined,
    "CSB_API_KEY is not set"
  );
}
