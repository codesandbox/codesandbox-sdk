import { Sandboxes } from "./Sandboxes";
import { ClientOpts } from "./types";

export { Sandboxes as SandboxClient };

export { VMTier } from "./VMTier";

export * from "./Sandbox";
export * from "./types";

import { HostTokens } from "./Hosts";
import { createClient, createConfig } from "@hey-api/client-fetch";
import { getBaseUrl } from "./utils/api";

export * from "./sessions/WebSocketSession";
export * from "./sessions/RestSession";

function ensure<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export class CodeSandbox {
  public readonly sandboxes: Sandboxes;

  /**
   * Provider for generating host tokens. These tokens can be used to generate signed
   * host URLs or headers for private sandboxes.
   */
  public readonly hosts: HostTokens;

  constructor(apiToken?: string, opts: ClientOpts = {}) {
    const evaluatedApiToken =
      apiToken ||
      ensure(
        typeof process !== "undefined"
          ? process.env?.CSB_API_KEY || process.env?.TOGETHER_API_KEY
          : undefined,
        "CSB_API_KEY or TOGETHER_API_KEY is not set"
      );

    const baseUrl =
      process.env.CSB_BASE_URL ?? opts.baseUrl ?? getBaseUrl(evaluatedApiToken);

    const apiClient = createClient(
      createConfig({
        baseUrl,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          ...(opts.headers ?? {}),
        },
        fetch: opts.fetch ?? fetch,
      })
    );

    this.sandboxes = new Sandboxes(apiClient);
    this.hosts = new HostTokens(apiClient);
  }
}
