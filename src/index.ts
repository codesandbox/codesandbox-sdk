import { SandboxClient } from "./SandboxClient";
import { ClientOpts } from "./types";

export { SandboxClient };

export { VMTier } from "./VMTier";

export * from "./Sandbox";
export * from "./types";
import * as WebSocketSession from "./clients/WebSocketClient";

export { WebSocketSession };

function ensure<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export { RestClient as RestClient } from "./clients/RestClient";

export class CodeSandbox {
  public readonly sandbox: SandboxClient;

  constructor(apiToken?: string, readonly opts: ClientOpts = {}) {
    const evaluatedApiToken =
      apiToken ||
      ensure(
        typeof process !== "undefined"
          ? process.env?.CSB_API_KEY || process.env?.TOGETHER_API_KEY
          : undefined,
        "CSB_API_KEY or TOGETHER_API_KEY is not set"
      );

    this.sandbox = new SandboxClient(evaluatedApiToken, opts);
  }
}
