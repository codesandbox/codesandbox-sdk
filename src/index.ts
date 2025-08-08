import { Sandboxes } from "./Sandboxes";

export { Sandboxes };

export { VMTier } from "./VMTier";

export * from "./Sandbox";
export * from "./types";
export { API } from "./API";

import { HostTokens } from "./HostTokens";
import { API } from "./API";
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
    const api = new API({ apiKey, config: opts });

    this.sandboxes = new Sandboxes(api, opts.tracer);
    this.hosts = new HostTokens(api);
  }
}
