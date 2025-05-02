import { SandboxClient } from "./SandboxClient";
import { ClientOpts } from "./types";

export { SandboxClient };

export { VMTier } from "./VMTier";

export * from "./Sandbox";
export * from "./types";

import { PreviewTokens } from "./PreviewTokens";
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
  public readonly sandbox: SandboxClient;

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

  constructor(apiToken?: string, readonly opts: ClientOpts = {}) {
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

    this.sandbox = new SandboxClient(apiClient);
    this.previewTokens = new PreviewTokens(apiClient);
  }
}
