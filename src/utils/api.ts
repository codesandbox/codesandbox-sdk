import { StartSandboxOpts } from "../types";
import { RateLimitError } from "./rate-limit";
import {
  Client,
  Config,
  createClient,
  createConfig,
} from "@hey-api/client-fetch";
import { getInferredBaseUrl } from "./constants";

async function enhanceFetch(
  request: Request,
  instrumentation?: (request: Request) => Promise<Response>
) {
  // Clone the request to modify headers
  const headers = new Headers(request.headers);
  const existingUserAgent = headers.get("User-Agent") || "";

  // Extend User-Agent with SDK version
  headers.set(
    "User-Agent",
    `${existingUserAgent ? `${existingUserAgent} ` : ""}codesandbox-sdk/${
      // @ts-expect-error - Replaced at build time
      CSB_SDK_VERSION
    }`.trim()
  );

  // Create new request with updated headers and optionally add instrumentation
  return instrumentation
    ? instrumentation(
        new Request(request, {
          headers,
        })
      )
    : fetch(
        new Request(request, {
          headers,
        })
      );
}

export function createApiClient(
  apiKey: string,
  config: Config = {},
  instrumentation?: (request: Request) => Promise<Response>
) {
  return createClient(
    createConfig({
      baseUrl: config.baseUrl || getInferredBaseUrl(apiKey),
      fetch: (request) => enhanceFetch(request, instrumentation),
      ...config,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...config.headers,
      },
    })
  );
}

export type HandledResponse<D, E> = {
  data?: {
    data?: D;
  };
  error?: E;
  response: Response;
};

export function getStartOptions(opts: StartSandboxOpts | undefined) {
  if (!opts) return {};

  // Warn about hibernation timeouts that are too short and may cause connection issues
  if (opts.hibernationTimeoutSeconds !== undefined && opts.hibernationTimeoutSeconds < 60) {
    console.warn(
      `Warning: hibernationTimeoutSeconds (${opts.hibernationTimeoutSeconds}s) is less than 60 seconds. ` +
      `This may cause connection instability and frequent disconnections. ` +
      `Consider using at least 60 seconds for stable websocket connections.`
    );
  }

  return {
    ipcountry: opts.ipcountry,
    tier: opts.vmTier?.name,
    hibernation_timeout_seconds: opts.hibernationTimeoutSeconds,
    automatic_wakeup_config: opts.automaticWakeupConfig,
  };
}

export function getDefaultTemplateTag(apiClient: Client): string {
  if (apiClient.getConfig().baseUrl?.includes("codesandbox.stream")) {
    return "7ngcrf";
  }

  return "pcz35m";
  // Universal template created 2025-06-05
  // return "universal@latest";
}

export function getDefaultTemplateId(apiClient: Client): string {
  if (apiClient.getConfig().baseUrl?.includes("codesandbox.stream")) {
    return "7ngcrf";
  }

  return "pcz35m";
}

export async function retryWithDelay<T>(
  callback: () => Promise<T>,
  retries: number = 3,
  delay: number = 500
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await callback();
    } catch (error) {
      lastError = error as Error;

      if (attempt === retries) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export function handleResponse<D, E>(
  result: Awaited<{ data?: { data?: D }; error?: E; response: Response }>,
  errorPrefix: string
): D {
  if (result.response.status === 429 && "error" in result) {
    const error = (result.error as { errors: string[] }).errors[0];
    throw RateLimitError.fromResponse(result.response, errorPrefix, error);
  }

  if (result.response.status === 404) {
    throw new Error(errorPrefix + ": Sandbox not found");
  }

  if (result.response.status === 403) {
    throw new Error(errorPrefix + ": Unauthorized");
  }

  if (result.response.status === 502) {
    throw new Error(errorPrefix + ": Bad gateway");
  }

  if (result.response.status === 503) {
    throw new Error(errorPrefix + ": The sandbox is currently overloaded. Please review your logic to reduce the number of concurrent requests or try again in a moment.");
  }

  if ("error" in result) {
    const error = (result.error as { errors: string[] }).errors[0];
    throw new Error(errorPrefix + ": " + error);
  }

  if (!result.data || !result.data.data) {
    throw new Error(errorPrefix + ": No data returned");
  }

  return result.data.data;
}
