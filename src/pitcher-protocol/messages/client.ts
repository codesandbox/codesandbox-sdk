import { PitcherCapabilities, PitcherPermissions } from "../capabilities";
import { ProtocolError, TMessage, TNotification } from "../protocol";
import { ClientSubscriptions } from "../subscriptions";

export type ClientJSON = {
  clientId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  /** app id: "vscode", "playjs", "codesandbox", ... */
  appId: string;
};

export enum ClientAuthorization {
  READ = "Read",
  WRITE = "Write",
  OWNER = "Owner",
}

export enum ClientDisposeReason {
  AUTHORIZATION_CHANGED = "AuthorizationChanged",
  DISCONNECT = "Disconnect",
  PITCHER_SHUTDOWN = "PitcherShutdown",
}

export type CommonError = ProtocolError;

export interface ClientJoinParams {
  clientInfo: {
    // version of @codesandbox/pitcher-protocol
    protocolVersion: string;
    /** app id: "vscode", "playjs", "codesandbox", ... */
    appId: string;
  };
  /**
   * This tells pitcher that the client will listen for async progress messages
   * If this is false and pitcher is still initializing it will wait with
   * sending the result until it's finished with initializing
   */
  asyncProgress?: boolean;
  subscriptions: ClientSubscriptions;
}

export interface ClientJoinResult {
  client: ClientJSON;
  workspacePath: string;
  // version of pitcher
  version: string;
  // version of @codesandbox/pitcher-protocol
  protocolVersion: string;
  latestPitcherVersion: string;

  capabilities: PitcherCapabilities;
  permissions: PitcherPermissions;
  isProtected: boolean;
  // a token which holds information about clientId and color, for consistency
  // between reconnects
  reconnectToken: string;
}

export type ClientJoinMessage = TMessage<
  "client/join",
  ClientJoinParams,
  {
    result: ClientJoinResult;
    error: CommonError;
  }
>;

export type ClientListMessage = TMessage<
  "client/list",
  Record<string, never>,
  {
    result: ClientJSON[];
    error: CommonError;
  }
>;

export type ClientMessage = ClientListMessage | ClientJoinMessage;

export type ClientRequest = ClientMessage["request"];

export type ClientResponse = ClientMessage["response"];

export type ClientDisconnectedNotification = TNotification<
  "client/disconnected",
  {
    clientId: string;
    reason: ClientDisposeReason;
  }
>;

export type ClientConnectedNotification = TNotification<
  "client/connected",
  ClientJSON
>;

export type ClientUpdatedNotification = TNotification<
  "client/updated",
  ClientJSON
>;

export type ClientPermissionsUpdate = TNotification<
  "client/permissions",
  {
    isProtected: boolean;
    permissions: PitcherPermissions;
  }
>;

export type ClientNotification =
  | ClientDisconnectedNotification
  | ClientConnectedNotification
  | ClientUpdatedNotification
  | ClientPermissionsUpdate;
