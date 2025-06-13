import { Disposable } from "./utils/disposable";
import { Client } from "@hey-api/client-fetch";
import { handleResponse } from "./utils/api";
import {
  previewTokenCreate,
  previewTokenList,
  previewTokenRevokeAll,
  previewTokenUpdate,
} from "./api-clients/client";

interface BaseHostTokenInfo {
  expiresAt: Date | null;
  tokenId: string;
  lastUsedAt: Date | null;
}

export interface HostTokenInfo extends BaseHostTokenInfo {
  tokenPrefix: string;
}

export interface HostToken extends BaseHostTokenInfo {
  token: string;
  sandboxId: string;
}

/**
 * Provider for generating host tokens that can be used to access
 * private sandbox hosts. This provider is only available in environments
 * with an authenticated API client (like Node.js).
 */
export class HostTokens extends Disposable {
  constructor(private apiClient: Client) {
    super();
  }

  /**
   * Get url to access a private host using a host token.
   * The PORT argument is needed as all hosts are exposed with
   * a port.
   */
  getUrl(
    token: { sandboxId: string; token: string },
    port: number,
    protocol: string = "https"
  ): string {
    const domain = this.apiClient.getConfig().baseUrl?.includes(".stream")
      ? "csb.dev"
      : "csb.app";

    return `${protocol}://${token.sandboxId}-${port}.${domain}?preview_token=${token.token}`;
  }

  /**
   * Get headers to access a private host using a host token.
   */
  getHeaders(token: { sandboxId: string; token: string }) {
    return {
      "csb-preview-token": token.token,
    };
  }

  /**
   * Get cookies to access a private host using a host token.
   */
  getCookies(token: { sandboxId: string; token: string }) {
    return {
      csb_preview_token: token.token,
    };
  }

  /**
   * Generate a new host token that can be used to access private sandbox hosts. By default the token never expires.
   */
  async createToken(
    sandboxId: string,
    opts: { expiresAt?: Date } = {}
  ): Promise<HostToken> {
    const response = handleResponse(
      await previewTokenCreate({
        client: this.apiClient,
        path: {
          id: sandboxId,
        },
        body: {
          expires_at: opts.expiresAt?.toISOString(),
        },
      }),
      "Failed to create preview token"
    );

    if (!response.token?.token) {
      throw new Error("No token returned from API");
    }

    return {
      sandboxId,
      token: response.token.token,
      expiresAt: response.token.expires_at
        ? new Date(response.token.expires_at)
        : null,
      tokenId: response.token.token_id,
      lastUsedAt: response.token.last_used_at
        ? new Date(response.token.last_used_at)
        : null,
    };
  }

  /**
   * List all active host tokens for this sandbox.
   */
  async listTokens(sandboxId: string): Promise<HostTokenInfo[]> {
    const response = handleResponse(
      await previewTokenList({
        client: this.apiClient,
        path: {
          id: sandboxId,
        },
      }),
      "Failed to list host tokens"
    );

    if (!response.tokens) {
      return [];
    }

    return response.tokens.map((token) => ({
      expiresAt: token.expires_at ? new Date(token.expires_at) : null,
      tokenId: token.token_id,
      tokenPrefix: token.token_prefix,
      lastUsedAt: token.last_used_at ? new Date(token.last_used_at) : null,
    }));
  }

  /**
   * Revoke a single host token for this sandbox.
   */
  async revokeToken(sandboxId: string, tokenId: string): Promise<void> {
    handleResponse(
      await previewTokenUpdate({
        client: this.apiClient,
        path: {
          id: sandboxId,
          token_id: tokenId,
        },
        body: {
          expires_at: new Date().toISOString(),
        },
      }),
      "Failed to revoke host token"
    );
  }

  /**
   * Revoke all active host tokens for this sandbox.
   * This will immediately invalidate all tokens, and they can no longer be used
   * to access the sandbox host.
   */
  async revokeAllTokens(sandboxId: string): Promise<void> {
    handleResponse(
      await previewTokenRevokeAll({
        client: this.apiClient,
        path: {
          id: sandboxId,
        },
      }),
      "Failed to revoke host tokens"
    );
  }

  /**
   * Update a host token's expiration date.
   */
  async updateToken(
    sandboxId: string,
    tokenId: string,
    expiresAt: Date | null
  ): Promise<HostTokenInfo> {
    const response = handleResponse(
      await previewTokenUpdate({
        client: this.apiClient,
        path: {
          id: sandboxId,
          token_id: tokenId,
        },
        body: {
          expires_at: expiresAt?.toISOString(),
        },
      }),
      "Failed to update host token"
    );

    if (!response.token) {
      throw new Error("No token returned from API");
    }

    return {
      expiresAt: response.token.expires_at
        ? new Date(response.token.expires_at)
        : null,
      tokenId: response.token.token_id,
      tokenPrefix: response.token.token_prefix,
      lastUsedAt: response.token.last_used_at
        ? new Date(response.token.last_used_at)
        : null,
    };
  }
}
