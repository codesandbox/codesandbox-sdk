import {
  initPitcherClient,
  PitcherManagerResponse,
} from "@codesandbox/pitcher-client";

import { SandboxSession } from "./sandbox";
import { DEFAULT_SUBSCRIPTIONS } from "./sandbox-client";
import { SessionData } from "./sessions";

/**
 * With this function you can connect to a sandbox from the browser.
 *
 * ## Why does this exist?
 *
 * The CodeSandbox API is a REST API that you can use to control sandboxes. However, it
 * requires your CodeSandbox API token to be sent with every request. This makes it
 * unsafe to use from the browser, where you don't want to expose your API token.
 *
 * With this helper function, you can generate a sandbox on the server, and then share a single-use
 * token that can be used to create a connection to that sandbox from the browser.
 *
 * ## Example
 *
 * To use this function, you first need to start a sandbox on the server:
 *
 * ```ts
 * import { CodeSandbox } from "@codesandbox/sdk";
 *
 * const client = new CodeSandbox(apiToken);
 *
 * const startData = await client.sandbox.start("my-sandbox-id");
 * ```
 *
 * Then you can start a sandbox using this start data in the browser:
 *
 * ```ts
 * import { connectToSandbox } from "@codesandbox/sdk/browser";
 *
 * // Get the start data from the server
 * const startData = ...;
 *
 * const sandbox = await connectToSandbox(startData);
 * ```
 */
export async function connectToSandbox(
  session: SessionData
): Promise<SandboxSession> {
  const pitcherClient = await initPitcherClient(
    {
      appId: "sdk",
      instanceId: session.id,
      onFocusChange() {
        return () => {};
      },
      requestPitcherInstance: () =>
        Promise.resolve({
          bootupType: "RESUME",
          cluster: "session",
          id: session.id,
          latestPitcherVersion: "1.0.0-session",
          pitcherManagerVersion: "1.0.0-session",
          pitcherToken: session.pitcher_token,
          pitcherURL: session.pitcher_url,
          pitcherVersion: "1.0.0-session",
          reconnectToken: "",
          userWorkspacePath: session.user_workspace_path,
          workspacePath: session.user_workspace_path,
        }),
      subscriptions: DEFAULT_SUBSCRIPTIONS,
    },
    () => {}
  );

  return new SandboxSession(pitcherClient);
}
