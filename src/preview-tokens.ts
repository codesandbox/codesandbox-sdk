import { Disposable } from "./utils/disposable";
import { SandboxClient } from "./sandbox-client";

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
}

/**
 * Provider for generating preview tokens that can be used to access
 * private sandbox previews. This provider is only available in environments
 * with an authenticated API client (like Node.js).
 */
export class PreviewTokens extends Disposable {
  constructor(private sandboxId: string, private sandboxClient: SandboxClient) {
    super();
  }

  /**
   * Generate a new preview token that can be used to access private sandbox previews.
   *
   * @param opts - Options
   * @param opts.expiresAt - Optional expiration date for the preview token
   * @returns A preview token that can be used with Ports.getSignedPreviewUrl
   */
  async create(opts: { expiresAt?: Date } = {}): Promise<PreviewToken> {
    return this.sandboxClient.previewTokens.create(
      this.sandboxId,
      opts.expiresAt
    );
  }

  /**
   * List all active preview tokens for this sandbox.
   *
   * @returns A list of preview tokens
   */
  async list(): Promise<PreviewTokenInfo[]> {
    return this.sandboxClient.previewTokens.list(this.sandboxId);
  }

  /**
   * Revoke a single preview token for this sandbox.
   *
   * @param tokenId - The ID of the token to revoke
   */
  async revoke(tokenId: string): Promise<void> {
    return this.sandboxClient.previewTokens.revoke(this.sandboxId, tokenId);
  }

  /**
   * Revoke all active preview tokens for this sandbox.
   * This will immediately invalidate all tokens, and they can no longer be used
   * to access the sandbox preview.
   */
  async revokeAll(): Promise<void> {
    return this.sandboxClient.previewTokens.revokeAll(this.sandboxId);
  }

  /**
   * Update a preview token's expiration date.
   *
   * @param tokenId - The ID of the token to update
   * @param expiresAt - The new expiration date for the token (null for no expiration)
   * @returns The updated preview token info
   */
  async update(
    tokenId: string,
    expiresAt: Date | null
  ): Promise<PreviewTokenInfo> {
    return this.sandboxClient.previewTokens.update(
      this.sandboxId,
      tokenId,
      expiresAt
    );
  }
}
