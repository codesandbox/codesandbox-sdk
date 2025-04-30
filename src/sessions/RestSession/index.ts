import { Client, createClient, createConfig } from "@hey-api/client-fetch";
import { decode, encode } from "@msgpack/msgpack";
import { SandboxRestFS } from "./sandbox-rest-fs";
import { SandboxRestContainer } from "./sandbox-rest-container";
import { SandboxRestGit } from "./sandbox-rest-git";
import { SandboxRestShell } from "./sandbox-rest-shell";
import { SandboxRestSystem } from "./sandbox-rest-system";
import { SandboxRestTask } from "./sandbox-rest-task";
import { SandboxSession } from "../../types";

export interface ClientOpts {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class RestSession {
  static id = 0;
  fs: SandboxRestFS;
  container: SandboxRestContainer;
  git: SandboxRestGit;
  shell: SandboxRestShell;
  system: SandboxRestSystem;
  task: SandboxRestTask;
  constructor(private session: SandboxSession, opts: ClientOpts = {}) {
    const client = this.createRestClient(opts);
    this.fs = new SandboxRestFS(session, client);
    this.container = new SandboxRestContainer(client);
    this.git = new SandboxRestGit(client);
    this.shell = new SandboxRestShell(client);
    this.system = new SandboxRestSystem(client);
    this.task = new SandboxRestTask(client);
  }
  private createRestClient(opts: ClientOpts): Client {
    const client = createClient(
      createConfig({
        bodySerializer: null,
        parseAs: "stream",
        headers: {
          ...(opts.headers ?? {}),
          "content-type": "application/x-msgpack",
        },
        throwOnError: true,
        fetch:
          opts.fetch ??
          // @ts-ignore
          ((url, params) => {
            return fetch(url, params);
          }),
      })
    );

    const session = this.session;

    return {
      post(opts) {
        const method = opts.url.substring(1);

        const message = {
          id: RestSession.id++,
          method,
          params: opts.body,
        };

        const encodedMessage = encode(message);

        // We have to create a baseUrl, because openapi fetcher always prefixes the url
        // with "/"
        const baseUrl = new URL(session.pitcherUrl);

        baseUrl.protocol = "https";
        baseUrl.pathname = "";

        return client
          .post({
            baseUrl: baseUrl.origin,
            url: `${session.sandboxId}?token=${session.pitcherToken}`,
            headers: {
              "content-length": encodedMessage.byteLength.toString(),
            },
            body: encodedMessage,
          })
          .then(async ({ response, error }) => {
            if (error) {
              throw error;
            }

            return decode(await response.arrayBuffer());
          }) as any;
      },
    } as Client;
  }
}
