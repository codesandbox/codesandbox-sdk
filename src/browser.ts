import {
  initPitcherClient,
  PitcherManagerResponse,
} from "@codesandbox/pitcher-client";

import { SandboxSession } from "./sandbox";
import { DEFAULT_SUBSCRIPTIONS, type SandboxStartData } from "./sandbox-client";
import { SessionConnectInfo } from "./sessions";

export { SandboxStartData };

function isStartData(
  data: SandboxStartData | SessionConnectInfo
): data is SandboxStartData {
  return "bootup_type" in data;
}

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
  startInfo: SandboxStartData | SessionConnectInfo
): Promise<SandboxSession> {
  const useStartData = isStartData(startInfo);

  let requestPitcherInstance: () => Promise<PitcherManagerResponse>;
  if (useStartData) {
    requestPitcherInstance = async () => {
      const data = startInfo;

      return {
        bootupType: data.bootup_type as "RUNNING" | "CLEAN" | "RESUME" | "FORK",
        pitcherURL: data.pitcher_url,
        workspacePath: data.workspace_path,
        userWorkspacePath: data.user_workspace_path,
        pitcherManagerVersion: data.pitcher_manager_version,
        pitcherVersion: data.pitcher_version,
        latestPitcherVersion: data.latest_pitcher_version,
        pitcherToken: data.pitcher_token,
        cluster: data.cluster,
      };
    };
  } else {
    requestPitcherInstance = async () => {
      const data = startInfo;

      return {
        bootupType: "RESUME",
        cluster: "session",
        id: data.id,
        latestPitcherVersion: "1.0.0-session",
        pitcherManagerVersion: "1.0.0-session",
        pitcherToken: data.pitcher_token,
        pitcherURL: data.pitcher_url,
        pitcherVersion: "1.0.0-session",
        reconnectToken: "",
        userWorkspacePath: data.user_workspace_path,
        workspacePath: data.user_workspace_path,
      };
    };
  }

  const pitcherClient = await initPitcherClient(
    {
      appId: "sdk",
      instanceId: startInfo.id,
      onFocusChange() {
        return () => {};
      },
      requestPitcherInstance,
      subscriptions: DEFAULT_SUBSCRIPTIONS,
    },
    () => {}
  );

  return new SandboxSession(pitcherClient);
}
