import * as protocol from "../pitcher-protocol";
import { SandboxSession } from "../types";
import { SandboxClient } from "../SandboxClient";
import { Tracer } from "@opentelemetry/api";

export * from "../SandboxClient";

export { createPreview, Preview } from "./previews";

type ConnectToSandboxOptions = {
  session: SandboxSession;
  getSession: (id: string) => Promise<SandboxSession>;
  onFocusChange?: (cb: (isFocused: boolean) => void) => () => void;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
  tracer?: Tracer;
};

/**
 * Connect to a Sandbox from the browser and automatically reconnect. `getSession` requires and endpoint that resumes the Sandbox. `onFocusChange` can be used to notify when a reconnect should happen.
 */
export async function connectToSandbox({
  session,
  getSession,
  onFocusChange = (notify) => {
    const listener = () => {
      notify(document.hasFocus());
    };
    window.addEventListener("visibilitychange", listener);
    return () => {
      window.removeEventListener("visibilitychange", listener);
    };
  },
  initStatusCb = () => {},
  tracer,
}: ConnectToSandboxOptions): Promise<SandboxClient> {
  const client = await SandboxClient.create(
    session,
    getSession,
    initStatusCb,
    tracer
  );

  onFocusChange((isFocused) => {
    // We immediately ping the connection when focusing, so that
    // we detect a disconnect as early as possible
    if (
      isFocused &&
      (client.state === "DISCONNECTED" || client.state === "HIBERNATED")
    ) {
      client.reconnect().catch((err) => {
        console.error("Failed to reconnect to sandbox:", err);
      });
    }
  });

  return client;
}
