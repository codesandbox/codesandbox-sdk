import {
  Disposable,
  initPitcherClient,
  PitcherManagerResponse,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";
import {
  type SandboxSession,
  type SessionCreateOptions,
  type SandboxBrowserSession,
  DEFAULT_SUBSCRIPTIONS,
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
import { SandboxClient, startVm } from "./SandboxClient";

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
    private apiClient: Client,
    private pitcherManagerResponse: PitcherManagerResponse
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
        ...(opts.git
          ? {
              git_access_token: opts.git.accessToken,
              git_user_email: opts.git.email,
              git_user_name: opts.git.name,
            }
          : {}),
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
      env: opts.env,
    };

    return session;
  }

  async connect(
    customSession?: SessionCreateOptions
  ): Promise<WebSocketSession> {
    let hasConnected = false;
    const pitcherClient = await initPitcherClient(
      {
        appId: "sdk",
        instanceId: this.id,
        onFocusChange() {
          return () => {};
        },
        requestPitcherInstance: async () => {
          // If we reconnect we have to resume the Sandbox and get new session details
          if (hasConnected) {
            this.pitcherManagerResponse = await startVm(
              this.apiClient,
              this.id
            );
          }

          const session = customSession
            ? await this.createSession(customSession)
            : this.globalSession;

          const headers = this.apiClient.getConfig().headers as Headers;

          if (headers.get("x-pitcher-manager-url")) {
            // This is a hack, we need to tell the global scheduler that the VM is running
            // in a different cluster than the one it'd like to default to.

            const preferredManager = headers
              .get("x-pitcher-manager-url")
              ?.replace("/api/v1", "")
              .replace("https://", "");
            const baseUrl = this.apiClient
              .getConfig()
              .baseUrl?.replace("api", "global-scheduler");

            await fetch(
              `${baseUrl}/api/v1/cluster/${session.sandboxId}?preferredManager=${preferredManager}`
            ).then((res) => res.json());
          }

          hasConnected = true;

          return {
            bootupType: this.bootupType,
            pitcherURL: session.pitcherUrl,
            workspacePath: session.userWorkspacePath,
            userWorkspacePath: session.userWorkspacePath,
            pitcherManagerVersion:
              this.pitcherManagerResponse.pitcherManagerVersion,
            pitcherVersion: this.pitcherManagerResponse.pitcherVersion,
            latestPitcherVersion:
              this.pitcherManagerResponse.latestPitcherVersion,
            pitcherToken: session.pitcherToken,
            cluster: this.cluster,
          };
        },
        subscriptions: DEFAULT_SUBSCRIPTIONS,
      },
      () => {}
    );

    return new WebSocketSession(pitcherClient, () => customSession?.env ?? {});
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
      env: customSession?.env,
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
