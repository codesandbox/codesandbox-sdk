import { initPitcherClient, protocol } from "@codesandbox/pitcher-client";
import { DEFAULT_SUBSCRIPTIONS, SandboxBrowserSession } from "./types";
import { WebSocketSession } from "./sessions/WebSocketSession";

export * from "./sessions/WebSocketSession";

export { createPreview, Preview } from "./previews";

/**
 * Connect to a Sandbox from the browser and automatically reconnect. `getSession` requires and endpoint that resumes the Sandbox. `onFocusChange` can be used to notify when a reconnect should happen.
 */
export async function connectToSandbox(options: {
  session: SandboxBrowserSession;
  getSession: (id: string) => Promise<SandboxBrowserSession>;
  onFocusChange?: (cb: (isFocused: boolean) => void) => () => void;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
}): Promise<WebSocketSession> {
  let hasConnected = false;
  const pitcherClient = await initPitcherClient(
    {
      appId: "sdk",
      instanceId: options.session.id,
      onFocusChange:
        options.onFocusChange ||
        (() => {
          return () => {};
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

  return new WebSocketSession(pitcherClient, {
    env: options.session.env,
    hostToken: options.session.hostToken,
  });
}
