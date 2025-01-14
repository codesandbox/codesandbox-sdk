import { Disposable } from "./utils/disposable";
import { SandboxClient } from "./sandbox-client";
import { SandboxSession } from ".";

export interface SessionCreateOptions {
  permission?: "read" | "write";
}

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
   */
  async create(
    sessionId: string,
    options: SessionCreateOptions = {}
  ): Promise<SandboxSession> {
    return this.apiClient.createSession(this.id, sessionId, options);
  }
}
