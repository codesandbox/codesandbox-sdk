import { createClient, createConfig } from "@hey-api/client-fetch";
import { SessionData } from "./sessions";
import { FileSystemRest } from "./filesystem-rest";
import { decode, encode } from "@msgpack/msgpack";
import {
  SuccessResponse,
  ErrorResponse,
  WriteFileRequest,
} from "./client-rest";

export interface ClientOpts {
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

export type RestRequester = <
  P extends {},
  S extends SuccessResponse,
  E extends ErrorResponse
>(
  method: string,
  params: P
) => Promise<S | E>;

export class RestClient {
  static id = 0;
  constructor(private opts: ClientOpts = {}) {}
  private createClient = (session: SessionData): RestRequester => {
    const url = new URL(session.pitcher_url);

    url.protocol = "https";

    const client = createClient(
      createConfig({
        bodySerializer: null,
        parseAs: "stream",
        baseUrl: url.origin,
        headers: {
          ...(this.opts.headers ?? {}),
          "content-type": "application/x-msgpack",
        },
        fetch:
          this.opts.fetch ??
          // @ts-ignore
          ((url, params) => {
            console.log("Fetching", url, params);
            return fetch(url, params);
          }),
      })
    );

    return (method, params) => {
      const message = {
        id: RestClient.id++,
        method,
        params,
      };
      console.log("Sending message", url.toString(), message);
      const encodedMessage = encode(message);

      return client
        .post({
          url: `/${session.id}?token=${session.pitcher_token}`,
          headers: {
            "content-length": encodedMessage.byteLength.toString(),
          },
          body: encodedMessage,
        })
        .then(async ({ response }) =>
          decode(await response.arrayBuffer())
        ) as any;
    };
  };
  fs = new FileSystemRest(this.createClient);
}
