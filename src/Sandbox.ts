import {
  PitcherManagerResponse,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";
import { type SessionCreateOptions, type SandboxSession } from "./types";
import {
  vmCreateSession,
  vmUpdateHibernationTimeout,
  vmUpdateSpecs,
} from "./api-clients/client";
import { handleResponse } from "./utils/api";
import { VMTier } from "./VMTier";
import { Client } from "@hey-api/client-fetch";
import { connectToSandbox } from "./node";
import { startVm } from "./Sandboxes";
import { SandboxClient } from "./SandboxClient";

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

  private async initializeCustomSession(
    customSession: SessionCreateOptions,
    session: SandboxSession
  ) {
    if (!customSession.git && !customSession.env) {
      return;
    }

    const client = await connectToSandbox({
      session,
      getSession: async () =>
        this.getSession(await startVm(this.apiClient, this.id), customSession),
    });

    if (customSession.env) {
      const envStrings = Object.entries(customSession.env)
        .map(([key, value]) => `export ${key}=${value}`)
        .join("\n");
      await client.commands.run(`echo "${envStrings}" > $HOME/.private/.env`);
    }

    if (customSession.git) {
      await Promise.all([
        client.commands.run(
          `echo "https://${customSession.git.username || "x-access-token"}:${
            customSession.git.accessToken
          }@${customSession.git.provider}" > $HOME/.private/.gitcredentials`
        ),
        client.commands.run(
          `echo "[user]
    name  = ${customSession.git.name || customSession.id}
    email = ${customSession.git.email}
[init]
    defaultBranch = main
[credential]
    helper = store --file ~/.private/.gitcredentials" > $HOME/.gitconfig`
        ),
      ]);
    }

    return client;
  }

  private async getSession(
    pitcherManagerResponse: PitcherManagerResponse,
    customSession?: SessionCreateOptions
  ): Promise<SandboxSession> {
    if (!customSession) {
      return {
        sandboxId: this.id,
        bootupType: this.bootupType,
        cluster: this.cluster,
        latestPitcherVersion: pitcherManagerResponse.latestPitcherVersion,
        pitcherManagerVersion: pitcherManagerResponse.pitcherManagerVersion,
        pitcherToken: pitcherManagerResponse.pitcherToken,
        pitcherURL: pitcherManagerResponse.pitcherURL,
        userWorkspacePath: pitcherManagerResponse.userWorkspacePath,
        workspacePath: pitcherManagerResponse.workspacePath,
        pitcherVersion: pitcherManagerResponse.pitcherVersion,
      };
    }

    if (customSession.id.length > 20) {
      throw new Error("Session ID must be 20 characters or less");
    }

    const response = await vmCreateSession({
      client: this.apiClient,
      body: {
        session_id: customSession.id,
        permission: customSession.permission ?? "write",
        ...(customSession.git
          ? {
              git_access_token: customSession.git.accessToken,
              git_user_email: customSession.git.email,
              git_user_name: customSession.git.name,
            }
          : {}),
      },
      path: {
        id: this.id,
      },
    });

    const handledResponse = handleResponse(
      response,
      `Failed to create session ${customSession.id}`
    );

    return {
      sandboxId: this.id,
      sessionId: customSession?.id,
      hostToken: customSession?.hostToken,
      bootupType: this.bootupType,
      cluster: this.cluster,
      latestPitcherVersion: pitcherManagerResponse.latestPitcherVersion,
      pitcherManagerVersion: pitcherManagerResponse.pitcherManagerVersion,
      pitcherToken: handledResponse.pitcher_token,
      pitcherURL: handledResponse.pitcher_url,
      userWorkspacePath: handledResponse.user_workspace_path,
      workspacePath: pitcherManagerResponse.workspacePath,
      pitcherVersion: pitcherManagerResponse.pitcherVersion,
    };
  }

  async connect(customSession?: SessionCreateOptions) {
    const session = await this.getSession(
      this.pitcherManagerResponse,
      customSession
    );

    let client: SandboxClient | undefined;

    // We might create a client here if git or env is configured, we can reuse that
    if (customSession) {
      client = await this.initializeCustomSession(customSession, session);
    }

    return (
      client ||
      connectToSandbox({
        session,
        getSession: async () =>
          this.getSession(
            await startVm(this.apiClient, this.id),
            customSession
          ),
      })
    );
  }

  /**
   * @deprecated Use createSession instead
   */
  async createBrowserSession(customSession?: SessionCreateOptions) {
    return this.createSession(customSession);
  }

  async createSession(
    customSession?: SessionCreateOptions
  ): Promise<SandboxSession> {
    const session = await this.getSession(
      this.pitcherManagerResponse,
      customSession
    );

    if (customSession) {
      const client = await this.initializeCustomSession(customSession, session);
      client?.disconnect();
    }

    return session;
  }
}
