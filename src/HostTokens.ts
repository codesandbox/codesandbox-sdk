import { Disposable } from "./utils/disposable";
import { API } from "./API";

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
  constructor(private api: API) {
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
    const domain = this.api.getConfig().baseUrl?.includes(".stream")
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
   * Generate a new host token that can be used to access private sandbox hosts.
   */
  async createToken(
    sandboxId: string,
    opts: { expiresAt: Date }
  ): Promise<HostToken> {
    const response = await this.api.createPreviewToken(sandboxId, {
      expires_at: opts.expiresAt.toISOString(),
    });

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
    const response = await this.api.listPreviewTokens(sandboxId);

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
    await this.api.updatePreviewToken(sandboxId, tokenId, {
      expires_at: new Date().toISOString(),
    });
  }

  /**
   * Revoke all active host tokens for this sandbox.
   * This will immediately invalidate all tokens, and they can no longer be used
   * to access the sandbox host.
   */
  async revokeAllTokens(sandboxId: string): Promise<void> {
    await this.api.revokeAllPreviewTokens(sandboxId);
  }

  /**
   * Update a host token's expiration date.
   */
  async updateToken(
    sandboxId: string,
    tokenId: string,
    expiresAt: Date | null
  ): Promise<HostTokenInfo> {
    const response = await this.api.updatePreviewToken(sandboxId, tokenId, {
      expires_at: expiresAt?.toISOString(),
    });

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
