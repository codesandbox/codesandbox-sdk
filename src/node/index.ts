import { version } from "../pitcher-protocol";
import { DEFAULT_SUBSCRIPTIONS, SandboxSession } from "../types";
import { AgentConnection } from "./AgentConnection";
import { NodeAgentClient } from "./AgentClient";
import { SandboxClient } from "../SandboxClient";

// Timeout for detecting a pong response, leading to a forced disconnect
let PONG_DETECTION_TIMEOUT = 15_000;

export async function connectToSandbox({
  session,
  getSession,
}: {
  session: SandboxSession;
  getSession: (sandboxId: string) => Promise<SandboxSession>;
}) {
  const url = `${session.pitcherURL}/?token=${session.pitcherToken}`;
  const agentConnection = await AgentConnection.create(url);
  const joinResult = await agentConnection.request({
    method: "client/join",
    params: {
      clientInfo: {
        protocolVersion: version,
        appId: "sdk",
      },
      asyncProgress: true,
      subscriptions: DEFAULT_SUBSCRIPTIONS,
    },
  });

  // Now that we have initialized we set an appropriate timeout to more efficiently detect disconnects
  agentConnection.connection.setPongDetectionTimeout(PONG_DETECTION_TIMEOUT);

  const agentClient = new NodeAgentClient(getSession, agentConnection, {
    sandboxId: session.sandboxId,
    workspacePath: session.userWorkspacePath,
    reconnectToken: joinResult.reconnectToken,
    isUpToDate: session.latestPitcherVersion === session.pitcherVersion,
  });

  const client = await SandboxClient.create(agentClient, {
    username: joinResult.client.username,
    hostToken: session.hostToken,
  });

  return client;
}
