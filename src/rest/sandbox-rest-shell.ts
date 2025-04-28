import { Client } from "@hey-api/client-fetch";
import * as shell from "../clients/client-rest-shell";
import { SandboxSessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestShell {
  constructor(private client: Client) {}

  private createRestParams<T>(session: SandboxSessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  create(session: SandboxSessionData, body: shell.ShellCreateData["body"]) {
    return shell.shellCreate(this.createRestParams(session, body));
  }

  in(session: SandboxSessionData, body: shell.ShellInData["body"]) {
    return shell.shellIn(this.createRestParams(session, body));
  }

  list(session: SandboxSessionData, body: shell.ShellListData["body"]) {
    return shell.shellList(this.createRestParams(session, body));
  }

  open(session: SandboxSessionData, body: shell.ShellOpenData["body"]) {
    return shell.shellOpen(this.createRestParams(session, body));
  }

  close(session: SandboxSessionData, body: shell.ShellCloseData["body"]) {
    return shell.shellClose(this.createRestParams(session, body));
  }

  restart(session: SandboxSessionData, body: shell.ShellRestartData["body"]) {
    return shell.shellRestart(this.createRestParams(session, body));
  }

  terminate(
    session: SandboxSessionData,
    body: shell.ShellTerminateData["body"]
  ) {
    return shell.shellTerminate(this.createRestParams(session, body));
  }

  resize(session: SandboxSessionData, body: shell.ShellResizeData["body"]) {
    return shell.shellResize(this.createRestParams(session, body));
  }

  rename(session: SandboxSessionData, body: shell.ShellRenameData["body"]) {
    return shell.shellRename(this.createRestParams(session, body));
  }
}
