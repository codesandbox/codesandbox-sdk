import * as protocol from "../pitcher-protocol";
import { SandboxClient } from "../SandboxClient";
import { SandboxSession } from "../types";

type ConnectToSandboxOptions = {
  session: SandboxSession;
  getSession: (id: string) => Promise<SandboxSession>;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
};

export async function connectToSandbox({
  session,
  getSession,
  initStatusCb = () => {},
}: ConnectToSandboxOptions): Promise<SandboxClient> {
  return SandboxClient.create(session, getSession, initStatusCb);
}
