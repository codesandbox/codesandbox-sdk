import type { HostToken } from "../HostTokens";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

export type { HostToken };

export class Hosts {
  constructor(
    private sandboxId: string,
    private hostToken?: HostToken,
    private tracer?: Tracer
  ) {}

  private async withSpan<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean> = {},
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return operation();
    }

    return this.tracer.startActiveSpan(
      operationName,
      { attributes },
      async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * If private Sandbox this will return a URL with a host token.
   */
  getUrl(port: number, protocol: string = "https") {
    return `${protocol}://${this.sandboxId}-${port}.csb.app${
      this.hostToken ? `?preview_token=${this.hostToken.token}` : ""
    }`;
  }

  /**
   * If private Sandbox this will return headers with a host token.
   */
  getHeaders(): Record<string, string> {
    if (!this.hostToken) {
      return {};
    }

    return {
      "csb-preview-token": this.hostToken.token,
    };
  }

  /**
   * If private Sandbox this will return cookies with a host token.
   */
  getCookies(): Record<string, string> {
    if (!this.hostToken) {
      return {};
    }

    return {
      csb_preview_token: this.hostToken.token,
    };
  }
}
