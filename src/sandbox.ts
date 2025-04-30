import {
  Disposable,
  PitcherManagerResponse,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";
import type {
  SandboxSession,
  SessionCreateOptions,
  SandboxBrowserSession,
} from "./types";
import { Client } from "@hey-api/client-fetch";
import {
  vmCreateSession,
  vmUpdateHibernationTimeout,
  vmUpdateSpecs,
} from "./api-clients/client";
import { handleResponse } from "./utils/api";
import { VMTier } from "./VMTier";
import { WebSocketSession } from "./sessions/WebSocketSession";
import { RestSession } from "./sessions/RestSession";

export class Sandbox {
  get bootupType() {
    return this.pitcherManagerResponse.bootupType;
  }
  get cluster() {
    return this.pitcherManagerResponse.cluster;
  }
  get isUpToDate() {
    return (
      this.pitcherManagerResponse.latestPitcherVersion ===
      this.pitcherManagerResponse.pitcherVersion
    );
  }
  private get globalSession() {
    return {
      sandboxId: this.id,
      pitcherToken: this.pitcherManagerResponse.pitcherToken,
      pitcherUrl: this.pitcherManagerResponse.pitcherURL,
      userWorkspacePath: this.pitcherManagerResponse.userWorkspacePath,
    };
  }
  constructor(
    public id: string,
    private pitcherManagerResponse: PitcherManagerResponse,
    private apiClient: Client
  ) {}

  /**
   * Updates the specs that this sandbox runs on. It will dynamically scale the sandbox to the
   * new specs without a reboot. Be careful when scaling specs down, if the VM is using more memory
   * than it can scale down to, it can become very slow.
   *
   * @param id The ID of the sandbox to update
   * @param tier The new VM tier
   */
  async updateTier(sandboxId: string, tier: VMTier): Promise<void> {
    const response = await vmUpdateSpecs({
      client: this.apiClient,
      path: { id: sandboxId },
      body: {
        tier: tier.name,
      },
    });

    handleResponse(response, `Failed to update sandbox tier ${sandboxId}`);
  }

  async updateHibernationTimeout(
    sandboxId: string,
    timeoutSeconds: number
  ): Promise<void> {
    const response = await vmUpdateHibernationTimeout({
      client: this.apiClient,
      path: { id: sandboxId },
      body: { hibernation_timeout_seconds: timeoutSeconds },
    });

    handleResponse(
      response,
      `Failed to update hibernation timeout for sandbox ${sandboxId}`
    );
  }

  private async createSession(
    opts: SessionCreateOptions
  ): Promise<SandboxSession> {
    const response = await vmCreateSession({
      client: this.apiClient,
      body: {
        session_id: opts.id,
        permission: opts.permission ?? "write",
      },
      path: {
        id: this.id,
      },
    });

    const handledResponse = handleResponse(
      response,
      `Failed to create session ${opts.id}`
    );

    const session: SandboxSession = {
      sandboxId: this.id,
      pitcherToken: handledResponse.pitcher_token,
      pitcherUrl: handledResponse.pitcher_url,
      userWorkspacePath: handledResponse.user_workspace_path,
    };

    return session;
  }

  async connect(
    customSession?: SessionCreateOptions
  ): Promise<WebSocketSession> {
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

    return WebSocketSession.init(session, this.apiClient);
  }

  async createRestSession(customSession?: SessionCreateOptions) {
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

    return new RestSession(session);
  }

  async createBrowserSession(
    customSession?: SessionCreateOptions
  ): Promise<SandboxBrowserSession> {
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

    return {
      id: this.id,
      bootupType: this.bootupType,
      cluster: this.cluster,
      latestPitcherVersion: this.pitcherManagerResponse.latestPitcherVersion,
      pitcherManagerVersion: this.pitcherManagerResponse.pitcherManagerVersion,
      pitcherToken: session.pitcherToken,
      pitcherURL: session.pitcherUrl,
      userWorkspacePath: session.userWorkspacePath,
      workspacePath: this.pitcherManagerResponse.workspacePath,
      pitcherVersion: this.pitcherManagerResponse.pitcherVersion,
    };
  }
}
