import { initPitcherClient, protocol } from "@codesandbox/pitcher-client";
import { DEFAULT_SUBSCRIPTIONS, SandboxSession } from "../types";
import { SandboxClient } from "../SandboxClient";
import { BrowserAgentClient } from "./BrowserAgentClient";

export * from "../SandboxClient";

export { createPreview, Preview } from "./previews";

/**
 * Connect to a Sandbox from the browser and automatically reconnect. `getSession` requires and endpoint that resumes the Sandbox. `onFocusChange` can be used to notify when a reconnect should happen.
 */
export async function connectToSandbox(options: {
  session: SandboxSession;
  getSession: (id: string) => Promise<SandboxSession>;
  onFocusChange?: (cb: (isFocused: boolean) => void) => () => void;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
}): Promise<SandboxClient> {
  let hasConnected = false;
  const pitcherClient = await initPitcherClient(
    {
      appId: "sdk",
      instanceId: options.session.sandboxId,
      onFocusChange:
        options.onFocusChange ||
        ((notify) => {
          const listener = () => {
            notify(document.hasFocus());
          };
          window.addEventListener("visibilitychange", listener);
          return () => {
            window.removeEventListener("visibilitychange", listener);
          };
        }),
      requestPitcherInstance: async (id) => {
        const session = hasConnected
          ? await options.getSession(id)
          : options.session;

        hasConnected = true;

        return session;
      },
      subscriptions: DEFAULT_SUBSCRIPTIONS,
    },
    options.initStatusCb || (() => {})
  );

  const agentClient = new BrowserAgentClient(pitcherClient);
  const session = await SandboxClient.create(agentClient, {
    // On dedicated sessions we need the username to normalize
    // FS events
    username: options.session.sessionId
      ? // @ts-ignore
        pitcherClient["joinResult"].client.username
      : undefined,
    hostToken: options.session.hostToken,
  });

  return session;
}
