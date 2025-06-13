export const version = "0.367.10";

import * as notification from "./messages/notification";
import * as container from "./messages/container";
import * as language from "./messages/language";
import * as channel from "./messages/channel";
import * as command from "./messages/command";
import * as client from "./messages/client";
import * as system from "./messages/system";
import * as setup from "./messages/setup";
import * as shell from "./messages/shell";
import * as port from "./messages/port";
import * as task from "./messages/task";
import * as file from "./messages/file";
import * as git from "./messages/git";
import * as fs from "./messages/fs";
import * as ai from "./messages/ai";
import * as box from "./messages/box";

export * from "./protocol";
export * from "./message";

export type PitcherRequest =
  | ai.AiRequest
  | fs.FsRequest
  | client.ClientRequest
  | shell.ShellRequest
  | port.PortRequest
  | language.LanguageRequest
  | file.FileRequest
  | git.GitRequest
  | setup.SetupRequest
  | channel.ChannelRequest
  | task.TaskRequest
  | system.SystemRequest
  | command.CommandRequest
  | notification.NotificationRequest
  | container.ContainerRequest
  | box.BoxRequest;

export type PitcherResponse =
  | ai.AiResponse
  | fs.FsResponse
  | client.ClientResponse
  | shell.ShellResponse
  | port.PortResponse
  | language.LanguageResponse
  | file.FileResponse
  | git.GitResponse
  | setup.SetupResponse
  | channel.ChannelResponse
  | task.TaskResponse
  | system.SystemResponse
  | command.CommandResponse
  | notification.NotificationResponse
  | container.ContainerResponse
  | box.BoxResponse;

export type PitcherNotification =
  | ai.AiNotification
  | fs.FsNotification
  | shell.ShellNotification
  | client.ClientNotification
  | port.PortNotification
  | language.LanguageNotification
  | file.FileNotification
  | git.GitNotification
  | setup.SetupNotification
  | channel.ChannelNotification
  | task.TaskNotification
  | system.SystemNotification
  | command.CommandNotification
  | notification.NotificationNotification
  | container.ContainerNotification;

export { PitcherErrorCode } from "./errors";
export { ClientAuthorization, ClientDisposeReason } from "./messages/client";
export {
  PitcherCapabilities,
  PitcherPermissions,
  PitcherPermissionKeys,
} from "./capabilities";

export { PitcherSubscriptions, ClientSubscriptions } from "./subscriptions";

export * as ai from "./messages/ai";
export * as port from "./messages/port";
export * as language from "./messages/language";
export * as git from "./messages/git";
export * as setup from "./messages/setup";
export * as fs from "./messages/fs";
export * as client from "./messages/client";
export * as channel from "./messages/channel";
export * as task from "./messages/task";
export * as file from "./messages/file";
export * as system from "./messages/system";
export * as shell from "./messages/shell";
export * as command from "./messages/command";
export * as notification from "./messages/notification";
export * as box from "./messages/box";
