import { ProtocolError, TMessage, TNotification } from "../protocol";
import { PitcherErrorCode } from "../errors";

export type CommandFn = () => void | Promise<void>;

export type CommonError =
  | ProtocolError
  | {
      code: PitcherErrorCode.COMMAND_NOT_FOUND;
      message: string;
    };

export interface ICommand {
  /**
   * Unique id of the command, to be sent to pitcher for executing the command
   */
  id: string;

  /**
   * Name to display in the command palette
   * */
  displayName: string;

  // TODO: Add a way to send arguments to commands?
}

export type ListCommandsMessage = TMessage<
  "command/list",
  Record<string, never>,
  {
    result: {
      commands: ICommand[];
    };
    error: CommonError;
  }
>;

export type ExecuteCommandMessage = TMessage<
  "command/execute",
  {
    commandId: string;
  },
  {
    result: Record<string, never>;
    error: CommonError;
  }
>;

export type CommandsChangedNotification = TNotification<
  "command/changed",
  {
    commands: ICommand[];
  }
>;

export type CommandMessage = ListCommandsMessage | ExecuteCommandMessage;

export type CommandRequest = CommandMessage["request"];

export type CommandResponse = CommandMessage["response"];

export type CommandNotification = CommandsChangedNotification;
