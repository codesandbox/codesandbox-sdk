import {
  PitcherManagerResponse,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";
import { type SessionCreateOptions, type SandboxSession } from "./types";
import { VMTier } from "./VMTier";
import { API } from "./API";
import { connectToSandbox } from "./node";
import { SandboxClient } from "./SandboxClient";
import { StartSandboxOpts } from "./types";
import { retryWithDelay } from "./utils/api";

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
    private api: API,
    private pitcherManagerResponse: PitcherManagerResponse
  ) {}

  /**
   * Updates the specs that this sandbox runs on. It will dynamically scale the sandbox to the
   * new specs without a reboot. Be careful when scaling specs down, if the VM is using more memory
   * than it can scale down to, it can become very slow.
   */
  async updateTier(tier: VMTier): Promise<void> {
    await this.api.updateSpecs(this.id, {
      tier: tier.name,
    });
  }

  /**
   * Updates the hibernation timeout for this sandbox. This is the amount of seconds the sandbox
   * will be kept alive without activity before it is automatically hibernated. Activity can be sessions or interactions with any endpoints exposed by the Sandbox.
   */
  async updateHibernationTimeout(timeoutSeconds: number): Promise<void> {
    await this.api.updateHibernationTimeout(this.id, {
      hibernation_timeout_seconds: timeoutSeconds,
    });
  }

  private async initializeCustomSession(
    customSession: SessionCreateOptions,
    session: SandboxSession
  ) {
    const client = await connectToSandbox({
      session,
      getSession: async () =>
        this.getSession(await this.api.startVm(this.id), customSession),
    });

    if (customSession.env) {
      const envStrings = Object.entries(customSession.env)
        .map(([key, value]) => {
          // escape any single-quotes in the value
          const safe = value.replace(/'/g, `'\\"'`);
          return `export ${key}='${safe}'`;
        })
        .join("\n");
      const cmd = [
        `cat << 'EOF' > "$HOME/.private/.env"`,
        envStrings,
        `EOF`,
      ].join("\n");
      await client.commands.run(cmd);
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

    const handledResponse = await this.api.createSession(this.id, {
      session_id: customSession.id,
      permission: customSession.permission ?? "write",
    });

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
    return await retryWithDelay(async () => {
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
            this.getSession(await this.api.startVm(this.id), customSession),
        })
      );
    }, 3, 100);
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
    if (customSession?.git || customSession?.env) {
      const configureSession = await this.getSession(
        this.pitcherManagerResponse,
        customSession
      );

      const client = await this.initializeCustomSession(
        customSession,
        configureSession
      );

      client?.dispose();
    }

    return this.getSession(this.pitcherManagerResponse, customSession);
  }
}
