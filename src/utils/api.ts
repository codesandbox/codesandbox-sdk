import { PitcherManagerResponse } from "@codesandbox/pitcher-client";
import { VmStartResponse } from "../api-clients/client";
import { StartSandboxOpts } from "../types";
import { RateLimitError } from "./rate-limit";
import { Client } from "@hey-api/client-fetch";

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

export function getBaseUrl(token: string) {
  if (token.startsWith("csb_")) {
    return "https://api.codesandbox.io";
  }

  return "https://api.together.ai/csb/sdk";
}

export function getDefaultTemplateId(apiClient: Client): string {
  if (apiClient.getConfig().baseUrl?.includes("codesandbox.stream")) {
    return "7ngcrf";
  }

  return "pt_CW2BcBSPRoGb3AS6Fv7oXs";
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
