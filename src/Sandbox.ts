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
import { version } from "@codesandbox/pitcher-protocol";
import { createWebSocketClient } from "./NodeAgentClient/WebSocketClient";
import { AgentConnection } from "./NodeAgentClient/AgentConnection";
import { Session } from "./Session";
import { NodeAgentClient } from "./NodeAgentClient";

// Timeout for detecting a pong response, leading to a forced disconnect
let PONG_DETECTION_TIMEOUT = 15_000;

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
  async updateTier(tier: VMTier): Promise<void> {
    const response = await vmUpdateSpecs({
      client: this.apiClient,
      path: { id: this.id },
      body: {
        tier: tier.name,
      },
    });

    handleResponse(response, `Failed to update sandbox tier ${this.id}`);
  }

  /**
   * Updates the hibernation timeout for this sandbox. This is the amount of seconds the sandbox
   * will be kept alive without activity before it is automatically hibernated. Activity can be sessions or interactions with any endpoints exposed by the Sandbox.
   */
  async updateHibernationTimeout(timeoutSeconds: number): Promise<void> {
    const response = await vmUpdateHibernationTimeout({
      client: this.apiClient,
      path: { id: this.id },
      body: { hibernation_timeout_seconds: timeoutSeconds },
    });

    handleResponse(
      response,
      `Failed to update hibernation timeout for sandbox ${this.id}`
    );
  }

  private async createSession(
    opts: SessionCreateOptions
  ): Promise<SandboxSession> {
    if (opts.id.length > 20) {
      throw new Error("Session ID must be 20 characters or less");
    }

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
  async connect(customSession?: SessionCreateOptions): Promise<Session> {
    const sessionDetails = customSession
      ? await this.createSession(customSession)
      : this.globalSession;
    const url = `${sessionDetails.pitcherUrl}/?token=${sessionDetails.pitcherToken}`;

    const agentConnection = await AgentConnection.create(url);
    const joinResult = await agentConnection.request({
      method: "client/join",
      params: {
        clientInfo: {
          protocolVersion: version,
          appId: "sdk",
        },
        asyncProgress: true,
        subscriptions: DEFAULT_SUBSCRIPTIONS,
      },
    });

    // Now that we have initialized we set an appropriate timeout to more efficiently detect disconnects
    agentConnection.connection.setPongDetectionTimeout(PONG_DETECTION_TIMEOUT);

    const agentClient = new NodeAgentClient(this.apiClient, agentConnection, {
      sandboxId: this.id,
      workspacePath: sessionDetails.userWorkspacePath,
      reconnectToken: joinResult.reconnectToken,
      isUpToDate: this.isUpToDate,
    });

    const session = await Session.create(agentClient, {
      username: customSession ? joinResult.client.username : undefined,
      env: customSession?.env,
      hostToken: customSession?.hostToken,
    });

    if (customSession?.git) {
      const netrc = await session.commands.runBackground([
        `mkdir -p ~/private`,
        `cat > ~/private/.netrc <<EOF
machine ${customSession.git.provider}
login ${customSession.git.username || "x-access-token"}
password ${customSession.git.accessToken}
EOF`,
        `chmod 600 ~/private/.netrc`,
        `cd ~`,
        `ln -sfn private/.netrc .netrc`,
      ]);
      netrc.onOutput(console.log);
      console.log(await netrc.open());
      await netrc.waitUntilComplete();

      const config = await session.commands.runBackground([
        `cat > ~/private/.gitconfig <<EOF
[user]
    name  = ${customSession.git.name || customSession.id}
    email = ${customSession.git.email}
EOF`,
        `chmod 600 ~/private/.gitconfig`,
        `cd "~"`,
        `ln -sfn private/.gitconfig .gitconfig`,
      ]);
      config.onOutput(console.log);
      console.log(await config.open());
      await config.waitUntilComplete();
    }

    return session;
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
      sessionId: customSession?.id,
      hostToken: customSession?.hostToken,
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
