import { Disposable } from "./utils/disposable";
import { SandboxClient } from "./sandbox-client";

export interface SessionCreateOptions {
  id: string;
  permission?: "read" | "write";
  gitAccessToken?: string;
}

export type SandboxSessionData = {
  id: string;
  pitcher_token: string;
  pitcher_url: string;
  user_workspace_path: string;
};

export type SandboxSession = {
  sandboxId: string;
  pitcherToken: string;
  pitcherUrl: string;
  userWorkspacePath: string;
};

export class Sessions extends Disposable {
  constructor(
    private readonly id: string,
    private readonly apiClient: SandboxClient
  ) {
    super();
  }

  /**
   * Create a new session inside the VM. This is a new Linux user (inside the VM) with its
   * own home directory and permissions.
   *
   * @param sessionId The id of the session, this will also be used for the username
   * @param options Optional settings including permissions
   *
   * @returns if `autoConnect` is true, returns a `SandboxSession` object (which can be used to connect), otherwise returns
   * a connected session.
   */
  async create(opts: SessionCreateOptions): Promise<SandboxSession> {
    return this.apiClient["createSession"](this.id, opts);
  }

  /**
   * Creates or reuses a session inside the VM with read-only permissions. Because read-only sessions
   * cannot affect each-other, we use the same session id for all read-only sessions ("anonymous").
   *
   * @returns The new session
   */
  async createReadOnly(): Promise<SandboxSession> {
    return this.create({ id: "anonymous", permission: "read" });
  }
}
