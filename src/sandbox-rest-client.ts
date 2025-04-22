import { Client, createClient, createConfig } from "@hey-api/client-fetch";
import { decode, encode } from "@msgpack/msgpack";
import { SandboxRestFS } from "./rest/sandbox-rest-fs";
import { SandboxRestContainer } from "./rest/sandbox-rest-container";
import { SandboxRestGit } from "./rest/sandbox-rest-git";
import { SandboxRestShell } from "./rest/sandbox-rest-shell";
import { SandboxRestSystem } from "./rest/sandbox-rest-system";
import { SandboxRestTask } from "./rest/sandbox-rest-task";

export interface ClientOpts {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class SandboxRestClient {
  static id = 0;
  fs: SandboxRestFS;
  container: SandboxRestContainer;
  git: SandboxRestGit;
  shell: SandboxRestShell;
  system: SandboxRestSystem;
  task: SandboxRestTask;
  constructor(opts: ClientOpts = {}) {
    const client = this.createRestClient(opts);
    this.fs = new SandboxRestFS(client);
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
        fetch:
          opts.fetch ??
          // @ts-ignore
          ((url, params) => {
            return fetch(url, params);
          }),
      })
    );

    return {
      post(opts) {
        const method = opts.url.substring(1);

        const message = {
          id: SandboxRestClient.id++,
          method,
          params: opts.body,
        };

        const encodedMessage = encode(message);

        if (!opts.baseUrl) {
          throw new Error("You have to pass baseURL to the rest client");
        }

        // This is a hack to properly build the url. As "url" defaults to "/" in openapi client and breaks
        const urlParts = opts.baseUrl.split("/");
        const url = urlParts.pop()!;
        const baseUrl = urlParts.join("/");

        return client
          .post({
            baseUrl,
            url,
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
