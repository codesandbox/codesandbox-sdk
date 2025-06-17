import { Sandboxes } from "./Sandboxes";

export { Sandboxes as SandboxClient };

export { VMTier } from "./VMTier";

export * from "./Sandbox";
export * from "./types";

import { HostTokens } from "./HostTokens";
import { createApiClient } from "./utils/api";
import { ClientOpts } from "./types";
import { getInferredApiKey } from "./utils/constants";

export * from "./SandboxClient";

export class CodeSandbox {
  public readonly sandboxes: Sandboxes;

  /**
   * Provider for generating host tokens. These tokens can be used to generate signed
   * host URLs or headers for private sandboxes.
   */
  public readonly hosts: HostTokens;

  constructor(apiToken?: string, opts: ClientOpts = {}) {
    const apiKey = apiToken || getInferredApiKey();
    const apiClient = createApiClient("SDK", apiKey, opts);

    this.sandboxes = new Sandboxes(apiClient);
    this.hosts = new HostTokens(apiClient);
  }
}
