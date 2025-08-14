import type { Client, Config } from "@hey-api/client-fetch";
import { handleResponse, retryWithDelay, createApiClient } from "./utils/api";
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
    return retryWithDelay(
      async () => {
        const response = await vmHibernate({
          client: this.client,
          path: { id },
          body: data,
        });
        return handleResponse(response, `Failed to hibernate VM ${id}`);
      },
      3,
      200
    );
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
    return retryWithDelay(
      async () => {
        const response = await vmShutdown({
          client: this.client,
          path: { id },
          body: data,
        });
        return handleResponse(response, `Failed to shutdown VM ${id}`);
      },
      3,
      200
    );
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
    const handledResponse = await retryWithDelay(
      async () => {
        const response = await vmStart({
          client: this.client,
          path: { id },
          body: data,
        });
        return handleResponse(response, `Failed to start VM ${id}`);
      },
      3,
      retryDelay
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
