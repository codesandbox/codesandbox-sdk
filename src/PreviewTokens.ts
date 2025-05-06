import { Disposable } from "./utils/disposable";
import { Client } from "@hey-api/client-fetch";
import { handleResponse } from "./utils/api";
import {
  previewTokenCreate,
  previewTokenList,
  previewTokenRevokeAll,
  previewTokenUpdate,
} from "./api-clients/client";

interface BasePreviewTokenInfo {
  expiresAt: Date | null;
  tokenId: string;
  lastUsedAt: Date | null;
}

export interface PreviewTokenInfo extends BasePreviewTokenInfo {
  tokenPrefix: string;
}

export interface PreviewToken extends BasePreviewTokenInfo {
  token: string;
  sandboxId: string;
}

/**
 * Provider for generating preview tokens that can be used to access
 * private sandbox previews. This provider is only available in environments
 * with an authenticated API client (like Node.js).
 */
export class PreviewTokens extends Disposable {
  constructor(private apiClient: Client) {
    super();
  }

  /**
   * Get a signed preview URL for a port using a preview token.
   *
   * @param port - The port to get a signed preview URL for
   * @param token - The preview token to sign the URL with
   * @returns The signed preview URL, or undefined if the port is not open
   */
  getSignedPreviewUrl(token: PreviewToken, port: number): string {
    return `https://${token.sandboxId}-${port}.csb.app?preview_token=${token.token}`;
  }

  /**
   * Generate a new preview token that can be used to access private sandbox previews.
   *
   * @param opts - Options
   * @param opts.expiresAt - Optional expiration date for the preview token
   * @returns A preview token that can be used with Ports.getSignedPreviewUrl
   */
  async create(
    sandboxId: string,
    opts: { expiresAt?: Date } = {}
  ): Promise<PreviewToken> {
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
   * List all active preview tokens for this sandbox.
   *
   * @returns A list of preview tokens
   */
  async list(sandboxId: string): Promise<PreviewTokenInfo[]> {
    const response = handleResponse(
      await previewTokenList({
        client: this.apiClient,
        path: {
          id: sandboxId,
        },
      }),
      "Failed to list preview tokens"
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
   * Revoke a single preview token for this sandbox.
   *
   * @param tokenId - The ID of the token to revoke
   */
  async revoke(sandboxId: string, tokenId: string): Promise<void> {
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
      "Failed to revoke preview token"
    );
  }

  /**
   * Revoke all active preview tokens for this sandbox.
   * This will immediately invalidate all tokens, and they can no longer be used
   * to access the sandbox preview.
   */
  async revokeAll(sandboxId: string): Promise<void> {
    handleResponse(
      await previewTokenRevokeAll({
        client: this.apiClient,
        path: {
          id: sandboxId,
        },
      }),
      "Failed to revoke preview tokens"
    );
  }

  /**
   * Update a preview token's expiration date.
   *
   * @param tokenId - The ID of the token to update
   * @param expiresAt - The new expiration date for the token (null for no expiration)
   * @returns The updated preview token info
   */
  async update(
    sandboxId: string,
    tokenId: string,
    expiresAt: Date | null
  ): Promise<PreviewTokenInfo> {
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
      "Failed to update preview token"
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
