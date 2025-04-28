import { SandboxClient } from "./SandboxClient";
import { ClientOpts } from "./types";

export { SandboxClient };

export { VMTier } from "./VMTier";

export * from "./Sandbox";
export * from "./types";
import * as WebSocketSession from "./sessions/WebSocketSession";

export { WebSocketSession };

function ensure<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export { RestSession as RestClient } from "./sessions/RestSession";

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
