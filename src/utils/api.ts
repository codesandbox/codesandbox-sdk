import { PitcherManagerResponse } from "@codesandbox/pitcher-client";
import { VmStartResponse } from "../api-clients/client";
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

  return {
    ipcountry: opts.ipcountry,
    tier: opts.vmTier?.name,
    hibernation_timeout_seconds: opts.hibernationTimeoutSeconds,
    automatic_wakeup_config: opts.automaticWakeupConfig,
  };
}

export function getStartResponse(
  response: VmStartResponse["data"] | null
): PitcherManagerResponse {
  if (!response) {
    throw new Error("No start response");
  }

  return {
    bootupType: response.bootup_type as PitcherManagerResponse["bootupType"],
    cluster: response.cluster,
    pitcherURL: response.pitcher_url,
    workspacePath: response.workspace_path,
    userWorkspacePath: response.user_workspace_path,
    pitcherManagerVersion: response.pitcher_manager_version,
    pitcherVersion: response.pitcher_version,
    latestPitcherVersion: response.latest_pitcher_version,
    pitcherToken: response.pitcher_token,
  };
}

/**
 * Our infra has 2 min timeout, so we use that as default
 */
export async function withCustomTimeout<T>(
  cb: (signal: AbortSignal) => Promise<T>,
  timeoutSeconds: number = 120
) {
  const controller = new AbortController();
  const signal = controller.signal;
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutSeconds * 1000);

  try {
    // We have to await for the finally to run
    return await cb(signal);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Request took longer than ${timeoutSeconds}s, so we aborted.`
      );
    }

    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
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

  if ("error" in result) {
    const error = (result.error as { errors: string[] }).errors[0];
    throw new Error(errorPrefix + ": " + error);
  }

  if (!result.data || !result.data.data) {
    throw new Error(errorPrefix + ": No data returned");
  }

  return result.data.data;
}
