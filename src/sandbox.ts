import {
  Disposable,
  initPitcherClient,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";
import type {
  SandboxSession,
  SessionCreateOptions,
  StartSandboxOpts,
  CreateSandboxBaseOpts,
} from "./types";
import { PreviewTokens } from "./PreviewTokens";
import { Client } from "@hey-api/client-fetch";
import {
  vmCreateSession,
  vmHibernate,
  vmShutdown,
  vmStart,
  VmStartResponse,
  vmUpdateHibernationTimeout,
  vmUpdateSpecs,
} from "./clients/client";
import { handleResponse } from "./utils/api";
import { SandboxClient } from "./SandboxClient";
import { VMTier } from "./VMTier";
import { WebSocketSession } from "./sessions/WebSocketSession";
import { ClientOpts, RestSession } from "./sessions/RestSession";

export class Sandbox extends Disposable {
  private apiClient: Client;
  /**
   * Provider for generating preview tokens. These tokens can be used to generate signed
   * preview URLs for private sandboxes.
   *
   * @example
   * ```ts
   * const sandbox = await sdk.sandbox.create();
   * const previewToken = await sandbox.previewTokens.createToken();
   * const url = sandbox.ports.getSignedPreviewUrl(8080, previewToken.token);
   * ```
   */
  public readonly previewTokens: PreviewTokens;

  constructor(public id: string, private sandboxClient: SandboxClient) {
    super();
    this.apiClient = sandboxClient["apiClient"];
    this.previewTokens = this.addDisposable(
      new PreviewTokens(this.id, this.apiClient)
    );
  }

  private async start(startOpts?: StartSandboxOpts) {
    const startResult = await vmStart({
      client: this.apiClient,
      body: startOpts
        ? {
            ipcountry: startOpts.ipcountry,
            tier: startOpts.vmTier?.name,
            hibernation_timeout_seconds: startOpts.hibernationTimeoutSeconds,
            automatic_wakeup_config: startOpts.automaticWakeupConfig,
          }
        : undefined,
      path: {
        id: this.id,
      },
    });

    const response = handleResponse(
      startResult,
      `Failed to start sandbox ${this.id}`
    );

    return response;
  }

  private async createSession(
    options: SessionCreateOptions,
    globalSession: SandboxSession
  ): Promise<SandboxSession> {
    const response = await vmCreateSession({
      client: this.apiClient,
      body: {
        session_id: options.id,
        permission: options.permission ?? "write",
      },
      path: {
        id: this.id,
      },
    });

    const handledResponse = handleResponse(
      response,
      `Failed to create session ${options.id}`
    );

    const session: SandboxSession = {
      bootupType: globalSession.bootupType,
      cluster: globalSession.cluster,
      sandboxId: this.id,
      pitcherToken: handledResponse.pitcher_token,
      pitcherUrl: handledResponse.pitcher_url,
      userWorkspacePath: handledResponse.user_workspace_path,
    };

    return session;
  }

  /**
   * Creates a sandbox by forking an existing sandbox reference.
   *
   * This function will also start & connect to the VM of the created sandbox as a ROOT session, and return a {@link Sandbox}
   * that allows you to control the VM. Pass "autoConnect: false" to only return the session data.
   *
   * @param opts Additional options for creating the sandbox
   *
   * @returns A promise that resolves to a {@link Sandbox}, which you can use to control the VM
   */
  async fork(opts: CreateSandboxBaseOpts & StartSandboxOpts): Promise<Sandbox> {
    return this.sandboxClient.create({
      ...opts,
      source: "template",
      id: this.id,
    });
  }

  /**
   * Try to start a sandbox that already exists, it will return the data of the started
   * VM, which you can pass to the browser. In the browser you can call `connectToSandbox` with this
   * data to control the VM without sharing your CodeSandbox API token in the browser.
   *
   * @param id the ID of the sandbox
   * @returns The start data, contains a single use token to connect to the VM
   */
  public async resume(): Promise<void> {
    await this.start();
  }

  /**
   * Shuts down a sandbox. Files will be saved, and the sandbox will be stopped.
   *
   * @param sandboxId The ID of the sandbox to shutdown
   */
  async shutdown(): Promise<void> {
    this.dispose();
    const response = await vmShutdown({
      client: this.apiClient,
      path: {
        id: this.id,
      },
    });

    handleResponse(response, `Failed to shutdown sandbox ${this.id}`);
  }

  /**
   * Hibernates a sandbox. Files will be saved, and the sandbox will be put to sleep. Next time
   * you start the sandbox it will be resumed from the last state it was in.
   *
   * @param sandboxId The ID of the sandbox to hibernate
   */
  async hibernate(): Promise<void> {
    const response = await vmHibernate({
      client: this.apiClient,
      path: {
        id: this.id,
      },
    });

    handleResponse(response, `Failed to hibernate sandbox ${this.id}`);
  }

  /**
   * Updates the specs that this sandbox runs on. It will dynamically scale the sandbox to the
   * new specs without a reboot. Be careful when scaling specs down, if the VM is using more memory
   * than it can scale down to, it can become very slow.
   *
   * @param id The ID of the sandbox to update
   * @param tier The new VM tier
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
   * Updates the hibernation timeout of a sandbox.
   *
   * @param id The ID of the sandbox to update
   * @param timeoutSeconds The new hibernation timeout in seconds
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

  async session(opts?: SessionCreateOptions): Promise<SandboxSession> {
    const startData = await this.start();
    let session: SandboxSession = {
      bootupType: startData.bootup_type as SandboxSession["bootupType"],
      cluster: startData.cluster,
      sandboxId: this.id,
      pitcherToken: startData.pitcher_token,
      pitcherUrl: startData.pitcher_url,
      userWorkspacePath: startData.user_workspace_path,
    };

    if (opts) {
      session = await this.createSession(opts, session);
    }

    return session;
  }

  async connect(opts?: SessionCreateOptions): Promise<WebSocketSession> {
    const session = await this.session(opts);

    return WebSocketSession.init(session, this.apiClient);
  }

  async isUpToDate() {
    const startData = await this.start();

    return startData.latest_pitcher_version === startData.pitcher_version;
  }

  async rest(opts?: SessionCreateOptions & ClientOpts) {
    const session = await this.session(opts);

    return new RestSession(session, opts);
  }

  /**
   * Restart the sandbox. This will shutdown the sandbox, and then start it again. Files in
   * the project directory (`/project/sandbox`) will be preserved.
   *
   * Will resolve once the sandbox is rebooted.
   */
  public async restart(): Promise<void> {
    await this.shutdown();
    await this.resume();
  }
}
