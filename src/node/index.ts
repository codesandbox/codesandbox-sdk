import * as protocol from "../pitcher-protocol";
import { SandboxClient } from "../SandboxClient";
import { SandboxSession } from "../types";
import { Tracer } from "@opentelemetry/api";

type ConnectToSandboxOptions = {
  session: SandboxSession;
  getSession: (sandboxId: string) => Promise<SandboxSession>;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
  tracer?: Tracer;
};

export async function connectToSandbox({
  session,
  getSession,
  initStatusCb = () => {},
  tracer,
}: ConnectToSandboxOptions): Promise<SandboxClient> {
  return SandboxClient.create(session, getSession, initStatusCb, tracer);
}
