import { initPitcherClient, protocol } from "@codesandbox/pitcher-client";
import { DEFAULT_SUBSCRIPTIONS, SandboxBrowserSession } from "../types";
import { Session } from "../Session";
import { BrowserAgentClient } from "./BrowserAgentClient";

export * from "../Session";

export { createPreview, Preview } from "./previews";

/**
 * Connect to a Sandbox from the browser and automatically reconnect. `getSession` requires and endpoint that resumes the Sandbox. `onFocusChange` can be used to notify when a reconnect should happen.
 */
export async function connectToSandbox(options: {
  session: SandboxBrowserSession;
  getSession: (id: string) => Promise<SandboxBrowserSession>;
  onFocusChange?: (cb: (isFocused: boolean) => void) => () => void;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
}): Promise<Session> {
  let hasConnected = false;
  const pitcherClient = await initPitcherClient(
    {
      appId: "sdk",
      instanceId: options.session.id,
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
  const session = await Session.create(agentClient, {
    username: options.session.sessionId
      ? // @ts-ignore
        pitcherClient["joinResult"].client.username
      : undefined,
    env: options.session.env,
    hostToken: options.session.hostToken,
  });

  return session;
}
