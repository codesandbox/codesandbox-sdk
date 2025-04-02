import type { Client } from "@hey-api/client-fetch";

import {
  SandboxClient,
  CreateSandboxOpts,
  VMTier,
  SandboxListOpts,
  SandboxInfo,
  PaginationOpts,
} from "./sandbox-client";
import { SandboxRestFileSystem } from "./sandbox-rest-filesystem";
import { SandboxRestClient } from "./sandbox-rest-client";

export {
  SandboxClient,
  CreateSandboxOpts,
  VMTier,
  SandboxListOpts,
  SandboxInfo,
  PaginationOpts,
};
export * from "./sandbox";

export interface ClientOpts {
  baseUrl?: string;
  /**
   * Custom fetch implementation
   *
   * @default fetch
   */
  fetch?: typeof fetch;

  /**
   * Additional headers to send with each request
   */
  headers?: Record<string, string>;
}

export type SandboxPrivacy = "public" | "unlisted" | "private";

function ensure<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export { SandboxRestClient as RestClient } from "./sandbox-rest-client";

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
