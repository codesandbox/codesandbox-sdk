import { Client } from "@hey-api/client-fetch";
import * as shell from "../clients/client-rest-shell";
import { SessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestShell {
  constructor(private client: Client) {}

  private createRestParams<T>(session: SessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  create(session: SessionData, body: shell.ShellCreateData["body"]) {
    return shell.shellCreate(this.createRestParams(session, body));
  }

  in(session: SessionData, body: shell.ShellInData["body"]) {
    return shell.shellIn(this.createRestParams(session, body));
  }

  list(session: SessionData, body: shell.ShellListData["body"]) {
    return shell.shellList(this.createRestParams(session, body));
  }

  open(session: SessionData, body: shell.ShellOpenData["body"]) {
    return shell.shellOpen(this.createRestParams(session, body));
  }

  close(session: SessionData, body: shell.ShellCloseData["body"]) {
    return shell.shellClose(this.createRestParams(session, body));
  }

  restart(session: SessionData, body: shell.ShellRestartData["body"]) {
    return shell.shellRestart(this.createRestParams(session, body));
  }

  terminate(session: SessionData, body: shell.ShellTerminateData["body"]) {
    return shell.shellTerminate(this.createRestParams(session, body));
  }

  resize(session: SessionData, body: shell.ShellResizeData["body"]) {
    return shell.shellResize(this.createRestParams(session, body));
  }

  rename(session: SessionData, body: shell.ShellRenameData["body"]) {
    return shell.shellRename(this.createRestParams(session, body));
  }
}
