import type { Client } from "@hey-api/client-fetch";
import { createClient, createConfig } from "@hey-api/client-fetch";

import {
  SandboxClient,
  SandboxStartData,
  CreateSandboxOpts,
  VMTier,
  SandboxListOpts,
  SandboxInfo,
  PaginationOpts,
} from "./sandbox-client";

export {
  SandboxClient,
  SandboxStartData,
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

function getBaseUrl(token: string) {
  if (token.startsWith("csb_")) {
    return "https://api.codesandbox.io";
  }

  return "https://api.together.ai/csb/sdk";
}

export class CodeSandbox {
  private baseUrl: string;
  private apiToken: string;
  public readonly apiClient: Client;

  public readonly sandbox: SandboxClient;

  constructor(apiToken?: string, private readonly opts: ClientOpts = {}) {
    this.apiToken =
      apiToken ||
      ensure(
        typeof process !== "undefined"
          ? process.env?.CSB_API_KEY || process.env?.TOGETHER_API_KEY
          : undefined,
        "CSB_API_KEY or TOGETHER_API_KEY is not set"
      );
    this.baseUrl =
      process.env.CSB_BASE_URL ?? opts.baseUrl ?? getBaseUrl(this.apiToken);

    this.apiClient = createClient(
      createConfig({
        baseUrl: this.baseUrl,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          ...(opts.headers ?? {}),
        },
      })
    );

    this.sandbox = new SandboxClient(this.apiClient);
  }
}
