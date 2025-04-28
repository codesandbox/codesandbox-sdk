import { Client } from "@hey-api/client-fetch";
import * as shell from "../../clients/client-rest-shell";

export class SandboxRestShell {
  constructor(private client: Client) {}

  create(body: shell.ShellCreateData["body"]) {
    return shell.shellCreate({ client: this.client, body });
  }

  in(body: shell.ShellInData["body"]) {
    return shell.shellIn({ client: this.client, body });
  }

  list(body: shell.ShellListData["body"]) {
    return shell.shellList({ client: this.client, body });
  }

  open(body: shell.ShellOpenData["body"]) {
    return shell.shellOpen({ client: this.client, body });
  }

  close(body: shell.ShellCloseData["body"]) {
    return shell.shellClose({ client: this.client, body });
  }

  restart(body: shell.ShellRestartData["body"]) {
    return shell.shellRestart({ client: this.client, body });
  }

  terminate(body: shell.ShellTerminateData["body"]) {
    return shell.shellTerminate({ client: this.client, body });
  }

  resize(body: shell.ShellResizeData["body"]) {
    return shell.shellResize({ client: this.client, body });
  }

  rename(body: shell.ShellRenameData["body"]) {
    return shell.shellRename({ client: this.client, body });
  }
}
