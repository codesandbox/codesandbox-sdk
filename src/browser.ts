import { initPitcherClient, protocol } from "@codesandbox/pitcher-client";
import { DEFAULT_SUBSCRIPTIONS, SandboxBrowserSession } from "./types";
import { WebSocketSession } from "./sessions/WebSocketSession";

export * from "./sessions/WebSocketSession";

export { createPreview, Preview } from "./previews";

/**
 * Connect to a Sandbox from the browser and automatically reconnect. `getSession` requires and endpoint that resumes the Sandbox. `onFocusChange` can be used to notify when a reconnect should happen.
 */
export async function connectToSandbox(options: {
  id: string;
  getSession: (id: string) => Promise<SandboxBrowserSession>;
  onFocusChange?: (cb: (isFocused: boolean) => void) => () => void;
  initStatusCb?: (event: protocol.system.InitStatus) => void;
}): Promise<WebSocketSession> {
  let env: Record<string, string> = {};

  const pitcherClient = await initPitcherClient(
    {
      appId: "sdk",
      instanceId: options.id,
      onFocusChange:
        options.onFocusChange ||
        (() => {
          return () => {};
        }),
      requestPitcherInstance: async (id) => {
        const session = await options.getSession(id);

        if (session.env) {
          env = session.env;
        }

        return session;
      },
      subscriptions: DEFAULT_SUBSCRIPTIONS,
    },
    options.initStatusCb || (() => {})
  );

  return new WebSocketSession(pitcherClient, () => env);
}
