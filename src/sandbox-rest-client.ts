import { createClient, createConfig } from "@hey-api/client-fetch";
import { SessionData } from "./sessions";
import {
  FileSystemRestRequester,
  SandboxRestFileSystem,
} from "./sandbox-rest-filesystem";
import { decode, encode } from "@msgpack/msgpack";
import * as fs from "./client-rest-fs";

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

export class SandboxRestClient {
  static id = 0;
  fs: SandboxRestFileSystem;
  constructor(opts: ClientOpts = {}) {
    const createClient = this.createRestClientFactory(opts);
    this.fs = new SandboxRestFileSystem(createClient);
  }
  private createRestClientFactory(opts: ClientOpts) {
    return (session: SessionData): FileSystemRestRequester => {
      const url = new URL(session.pitcher_url);

      url.protocol = "https";

      const client = createClient(
        createConfig({
          bodySerializer: null,
          parseAs: "stream",
          baseUrl: url.origin,
          headers: {
            ...(opts.headers ?? {}),
            "content-type": "application/x-msgpack",
          },
          fetch:
            opts.fetch ??
            // @ts-ignore
            ((url, params) => {
              return fetch(url, params);
            }),
        })
      );

      return (method, params) => {
        const message = {
          id: SandboxRestClient.id++,
          method,
          params,
        };

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
  }
}
