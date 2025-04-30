import {
  Disposable,
  initPitcherClient,
  PitcherManagerResponse,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";
import type {
  SandboxSession,
  SessionCreateOptions,
  StartSandboxOpts,
  CreateSandboxBaseOpts,
  SandboxBrowserSession,
} from "./types";
import { PreviewTokens } from "./PreviewTokens";
import { Client } from "@hey-api/client-fetch";
import {
  vmCreateSession,
  vmHibernate,
  vmShutdown,
  vmUpdateHibernationTimeout,
  vmUpdateSpecs,
} from "./api-clients/client";
import { handleResponse } from "./utils/api";
import { SandboxClient } from "./SandboxClient";
import { VMTier } from "./VMTier";
import { WebSocketClient } from "./clients/WebSocketClient";
import { RestClient } from "./clients/RestClient";

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
    private sandboxClient: SandboxClient
  ) {
    super();

    this.apiClient = sandboxClient["apiClient"];
    this.previewTokens = this.addDisposable(
      new PreviewTokens(this.id, this.apiClient)
    );
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
    this.pitcherManagerResponse = await this.sandboxClient["start"](this.id);
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
  ): Promise<WebSocketClient> {
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

    return WebSocketClient.init(session, this.apiClient);
  }

  async createRestClient(customSession?: SessionCreateOptions) {
    const session = customSession
      ? await this.createSession(customSession)
      : this.globalSession;

    return new RestClient(session);
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
