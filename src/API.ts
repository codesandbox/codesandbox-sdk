import type { Client, Config } from "@hey-api/client-fetch";
import { createClient, createConfig } from "@hey-api/client-fetch";
import { handleResponse, retryWithDelay } from "./utils/api";
import { getInferredBaseUrl } from "./utils/constants";
import {
  metaInfo,
  workspaceCreate,
  tokenCreate,
  tokenUpdate,
  sandboxList,
  sandboxCreate,
  sandboxGet,
  sandboxFork,
  previewTokenRevokeAll,
  previewTokenList,
  previewTokenCreate,
  previewTokenUpdate,
  templatesCreate,
  vmAssignTagAlias,
  vmListClusters,
  vmListRunningVms,
  vmCreateTag,
  vmHibernate,
  vmUpdateHibernationTimeout,
  vmCreateSession,
  vmShutdown,
  vmUpdateSpecs,
  vmStart,
  vmUpdateSpecs2,
  previewHostList,
  previewHostCreate,
  previewHostUpdate,
} from "./api-clients/client";
import type {
  WorkspaceCreateData,
  TokenCreateData,
  TokenUpdateData,
  SandboxListData,
  SandboxCreateData,
  SandboxForkData,
  PreviewTokenCreateData,
  PreviewTokenUpdateData,
  TemplatesCreateData,
  VmAssignTagAliasData,
  VmCreateTagData,
  VmHibernateData,
  VmUpdateHibernationTimeoutData,
  VmCreateSessionData,
  VmShutdownData,
  VmUpdateSpecsData,
  VmStartRequest,
  VmUpdateSpecs2Data,
  PreviewHostListData,
  PreviewHostCreateData,
  PreviewHostUpdateData,
} from "./api-clients/client";
import { PitcherManagerResponse } from "./types";

function generateTraceParent(): string {
  // Generate W3C Trace Context traceparent header
  // Format: version-trace-id-span-id-trace-flags
  const version = '00'; // Current version is 00
  const traceId = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join(''); // 128-bit (32 hex chars)
  const spanId = Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join(''); // 64-bit (16 hex chars)
  const traceFlags = '01'; // Sampled flag set to 1
  
  return `${version}-${traceId}-${spanId}-${traceFlags}`;
}

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

  // Add W3C Trace Context traceparent header for OpenTelemetry correlation
  const traceparent = generateTraceParent();
  headers.set("traceparent", traceparent);

  const enhancedRequest = new Request(request, { headers });
  
  // Log API request details
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] [API REQUEST] ${request.method} ${request.url} traceparent=${traceparent}`);

  const startTime = Date.now();

  // Create new request with updated headers and optionally add instrumentation
  const response = instrumentation
    ? await instrumentation(enhancedRequest)
    : await fetch(enhancedRequest);

  const duration = Date.now() - startTime;

  // Log API response details
  const responseTimestamp = new Date().toISOString();
  let logMessage = `[${responseTimestamp}] [API RESPONSE] ${response.status} ${response.statusText} (${duration}ms) ${request.method} ${request.url} traceparent=${traceparent}`;
  
  // Add error message for non-success responses
  if (!response.ok) {
    try {
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      if (responseText) {
        // Try to parse as JSON to get error message, fallback to text
        try {
          const errorData = JSON.parse(responseText);
          const errorMessage = errorData.error || errorData.message || responseText;
          logMessage += ` error="${errorMessage}"`;
        } catch {
          logMessage += ` error="${responseText.substring(0, 200)}"`;
        }
      }
    } catch (e) {
      logMessage += ` error="[Unable to read error - ${e instanceof Error ? e.message : String(e)}]"`;
    }
  }
  
  console.log(logMessage);

  return response;
}

function createApiClient(
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

export interface APIOptions {
  apiKey: string;
  config?: Config;
  instrumentation?: (request: Request) => Promise<Response>;
}

export interface StartVmOptions extends VmStartRequest {
  retryDelay?: number;
}

export class API {
  private client: Client;

  constructor(options: APIOptions) {
    this.client = createApiClient(
      options.apiKey,
      options.config || {},
      options.instrumentation
    );
  }

  // Meta endpoints
  async getMetaInfo() {
    return metaInfo({ client: this.client });
  }

  // Workspace endpoints
  async createWorkspace(data?: WorkspaceCreateData["body"]) {
    const response = await workspaceCreate({
      client: this.client,
      body: data,
    });
    return handleResponse(response, "Failed to create workspace");
  }

  // Token endpoints
  async createToken(teamId: string, data: TokenCreateData["body"]) {
    const response = await tokenCreate({
      client: this.client,
      path: { team_id: teamId },
      body: data,
    });
    return handleResponse(
      response,
      `Failed to create token for team ${teamId}`
    );
  }

  async updateToken(
    teamId: string,
    tokenId: string,
    data: TokenUpdateData["body"]
  ) {
    const response = await tokenUpdate({
      client: this.client,
      path: { team_id: teamId, token_id: tokenId },
      body: data,
    });
    return handleResponse(
      response,
      `Failed to update token ${tokenId} for team ${teamId}`
    );
  }

  // Sandbox endpoints
  async listSandboxes(query?: SandboxListData["query"]) {
    const response = await sandboxList({
      client: this.client,
      query,
    });
    return handleResponse(response, "Failed to list sandboxes");
  }

  async createSandbox(data?: SandboxCreateData["body"]) {
    const response = await sandboxCreate({
      client: this.client,
      body: data,
    });
    return handleResponse(response, "Failed to create sandbox");
  }

  async getSandbox(id: string) {
    const response = await sandboxGet({
      client: this.client,
      path: { id },
    });
    return handleResponse(response, `Failed to get sandbox ${id}`);
  }

  async forkSandbox(id: string, data?: SandboxForkData["body"]) {
    const response = await sandboxFork({
      client: this.client,
      path: { id },
      body: data,
    });
    return handleResponse(response, `Failed to fork sandbox ${id}`);
  }

  // Preview token endpoints
  async revokeAllPreviewTokens(id: string) {
    const response = await previewTokenRevokeAll({
      client: this.client,
      path: { id },
    });
    return handleResponse(
      response,
      `Failed to revoke all preview tokens for ${id}`
    );
  }

  async listPreviewTokens(id: string) {
    const response = await previewTokenList({
      client: this.client,
      path: { id },
    });
    return handleResponse(response, `Failed to list preview tokens for ${id}`);
  }

  async createPreviewToken(id: string, data?: PreviewTokenCreateData["body"]) {
    const response = await previewTokenCreate({
      client: this.client,
      path: { id },
      body: data,
    });
    return handleResponse(response, `Failed to create preview token for ${id}`);
  }

  async updatePreviewToken(
    id: string,
    tokenId: string,
    data: PreviewTokenUpdateData["body"]
  ) {
    const response = await previewTokenUpdate({
      client: this.client,
      path: { id, token_id: tokenId },
      body: data,
    });
    return handleResponse(
      response,
      `Failed to update preview token ${tokenId} for ${id}`
    );
  }

  // Template endpoints
  async createTemplate(data: TemplatesCreateData["body"]) {
    const response = await templatesCreate({
      client: this.client,
      body: data,
    });
    return handleResponse(response, "Failed to create template");
  }

  // VM endpoints
  async assignVmTagAlias(
    namespace: string,
    alias: string,
    data: VmAssignTagAliasData["body"]
  ) {
    const response = await vmAssignTagAlias({
      client: this.client,
      path: { namespace, alias },
      body: data,
    });
    return handleResponse(
      response,
      `Failed to assign tag alias ${namespace}@${alias}`
    );
  }

  async listVmClusters() {
    const response = await vmListClusters({
      client: this.client,
    });
    return handleResponse(response, "Failed to list VM clusters");
  }

  async listRunningVms() {
    const response = await vmListRunningVms({
      client: this.client,
    });
    return handleResponse(response, "Failed to list running VMs");
  }

  async createVmTag(data?: VmCreateTagData["body"]) {
    const response = await vmCreateTag({
      client: this.client,
      body: data,
    });
    return handleResponse(response, "Failed to create VM tag");
  }

  async hibernate(id: string, data?: VmHibernateData["body"]) {
    const response = await retryWithDelay(
      () =>
        vmHibernate({
          client: this.client,
          path: { id },
          body: data,
        }),
      3,
      200
    );
    return handleResponse(response, `Failed to hibernate VM ${id}`);
  }

  async updateHibernationTimeout(
    id: string,
    data: VmUpdateHibernationTimeoutData["body"]
  ) {
    const response = await vmUpdateHibernationTimeout({
      client: this.client,
      path: { id },
      body: data,
    });
    return handleResponse(
      response,
      `Failed to update hibernation timeout for VM ${id}`
    );
  }

  async createSession(id: string, data: VmCreateSessionData["body"]) {
    const response = await vmCreateSession({
      client: this.client,
      path: { id },
      body: data,
    });
    return handleResponse(response, `Failed to create session for VM ${id}`);
  }

  async shutdown(id: string, data?: VmShutdownData["body"]) {
    const response = await retryWithDelay(
      () =>
        vmShutdown({
          client: this.client,
          path: { id },
          body: data,
        }),
      3,
      200
    );
    return handleResponse(response, `Failed to shutdown VM ${id}`);
  }

  async updateSpecs(id: string, data: VmUpdateSpecsData["body"]) {
    const response = await vmUpdateSpecs({
      client: this.client,
      path: { id },
      body: data,
    });
    return handleResponse(response, `Failed to update specs for VM ${id}`);
  }

  async startVm(id: string, options?: StartVmOptions) {
    const { retryDelay = 200, ...data } = options || {};
    const response = await retryWithDelay(
      () =>
        vmStart({
          client: this.client,
          path: { id },
          body: data,
        }),
      3,
      retryDelay
    );
    const handledResponse = handleResponse(
      response,
      `Failed to start VM ${id}`
    );

    return {
      bootupType:
        handledResponse.bootup_type as PitcherManagerResponse["bootupType"],
      cluster: handledResponse.cluster,
      pitcherURL: handledResponse.pitcher_url,
      workspacePath: handledResponse.workspace_path,
      userWorkspacePath: handledResponse.user_workspace_path,
      pitcherManagerVersion: handledResponse.pitcher_manager_version,
      pitcherVersion: handledResponse.pitcher_version,
      latestPitcherVersion: handledResponse.latest_pitcher_version,
      pitcherToken: handledResponse.pitcher_token,
    };
  }

  async updateVmSpecs2(id: string, data: VmUpdateSpecs2Data["body"]) {
    const response = await vmUpdateSpecs2({
      client: this.client,
      path: { id },
      body: data,
    });
    return handleResponse(response, `Failed to update VM specs2 for ${id}`);
  }

  // Preview host endpoints
  async listPreviewHosts(query?: PreviewHostListData["query"]) {
    const response = await previewHostList({
      client: this.client,
      query,
    });
    return handleResponse(response, "Failed to list preview hosts");
  }

  async createPreviewHost(data: PreviewHostCreateData["body"]) {
    const response = await previewHostCreate({
      client: this.client,
      body: data,
    });
    return handleResponse(response, "Failed to create preview host");
  }

  async updatePreviewHost(data: PreviewHostUpdateData["body"]) {
    const response = await previewHostUpdate({
      client: this.client,
      body: data,
    });
    return handleResponse(response, "Failed to update preview host");
  }

  // Get the underlying client for advanced use cases
  getClient(): Client {
    return this.client;
  }

  // Get client configuration
  getConfig(): Config {
    return this.client.getConfig();
  }
}
