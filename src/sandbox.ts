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
import { startVm } from "./Sandboxes";

export class Sandbox {
  /**
   * How the Sandbox booted up:
   * - RUNNING: Already running
   * - RESUME: Resumes from hibernation
   * - CLEAN: Clean bootup, no hibernation snapshot or shutdown
   * - FORK: When the sandbox was created from a template
   */
  get bootupType() {
    return this.pitcherManagerResponse.bootupType;
  }

  /**
   * The cluster the Sandbox is running on.
   */
  get cluster() {
    return this.pitcherManagerResponse.cluster;
  }

  /**
   * Whether the Sandbox Agent version is up to date. Use "restart" to
   * update the agent.
   */
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

  /**
   * Updates the hibernation timeout for this sandbox. This is the amount of seconds the sandbox
   * will be kept alive without activity before it is automatically hibernated. Activity can be sessions or interactions with any endpoints exposed by the Sandbox.
   */
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

  /**
   * Connects to the Sandbox using a WebSocket connection, allowing you to interact with it. You can pass a custom session to connect to a specific user workspace, controlling permissions, git credentials and environment variables.
   */
  async connect(
    customSession?: SessionCreateOptions
  ): Promise<WebSocketSession> {
    let hasConnected = false;
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

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

    return new WebSocketSession(pitcherClient, {
      env: customSession?.env,
      previewToken: customSession?.previewToken,
    });
  }

  /**
   * Returns a REST API client connected to this Sandbox, allowing you to interact with it. You can pass a custom session to connect to a specific user workspace, controlling permissions, git credentials and environment variables.
   */
  async createRestSession(customSession?: SessionCreateOptions) {
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

    return new RestSession(session);
  }

  /**
   * Returns a browser session connected to this Sandbox, allowing you to interact with it. You can pass a custom session to connect to a specific user workspace, controlling permissions, git credentials and environment variables.
   */
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
