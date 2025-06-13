import { ProtocolError, TMessage, TNotification } from "../protocol";
import { Id } from "@codesandbox/pitcher-common";
import { PitcherErrorCode } from "../errors";

export type ShellId = Id;

export type ShellSize = { cols: number; rows: number };

export type ShellProcessType = "TERMINAL" | "COMMAND";

export type ShellProcessStatus =
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "KILLED"
  | "RESTARTING";

type BaseShellDTO = {
  shellId: ShellId;
  name: string;
  status: ShellProcessStatus;
  exitCode?: number;
};

export type CommandShellDTO = BaseShellDTO & {
  shellType: "COMMAND";
  startCommand: string;
};

export type TerminalShellDTO = BaseShellDTO & {
  shellType: "TERMINAL";
  ownerUsername: string;
  isSystemShell: boolean;
};

export type ShellDTO = CommandShellDTO | TerminalShellDTO;

export type OpenCommandShellDTO = CommandShellDTO & {
  buffer: string[];
};

export type OpenTerminalShellDTO = TerminalShellDTO & {
  buffer: string[];
};

export type OpenShellDTO = OpenCommandShellDTO | OpenTerminalShellDTO;

export type CommonError =
  | {
      code: PitcherErrorCode.SHELL_NOT_ACCESSIBLE;
      message: string;
    }
  | ProtocolError;

export type ShellCreate = TMessage<
  "shell/create",
  {
    command?: string;
    cwd?: string;
    size?: ShellSize;
    type?: ShellProcessType;
    /**
     * Whether this shell is started by the editor itself to
     * run a specific process, like an LSP or internal server.
     * This is set to true if the command is not initiated by the user.
     */
    isSystemShell?: boolean;
  },
  {
    result: OpenShellDTO;
    error: CommonError;
  }
>;

export type ShellIn = TMessage<
  "shell/in",
  {
    shellId: ShellId;
    input: string;
    size: ShellSize;
  },
  {
    result: null;
    error: CommonError;
  }
>;

export type ShellList = TMessage<
  "shell/list",
  Record<string, never>,
  {
    result: {
      shells: ShellDTO[];
    };
    error: CommonError;
  }
>;

export type ShellOpen = TMessage<
  "shell/open",
  {
    shellId: ShellId;
    size: ShellSize;
  },
  {
    result: OpenShellDTO;
    error: CommonError;
  }
>;

export type ShellClose = TMessage<
  "shell/close",
  {
    shellId: ShellId;
  },
  {
    result: null;
    error: CommonError;
  }
>;

export type ShellRestart = TMessage<
  "shell/restart",
  {
    shellId: ShellId;
  },
  {
    result: null;
    error: CommonError;
  }
>;

export type ShellTerminate = TMessage<
  "shell/terminate",
  {
    shellId: ShellId;
  },
  {
    result: ShellDTO;
    error: CommonError;
  }
>;

export type ShellResize = TMessage<
  "shell/resize",
  {
    shellId: ShellId;
    size: ShellSize;
  },
  {
    result: null;
    error: CommonError;
  }
>;

export type ShellRename = TMessage<
  "shell/rename",
  { shellId: ShellId; name: string },
  {
    result: null;
    error: CommonError;
  }
>;

type ShellMessage =
  | ShellCreate
  | ShellIn
  | ShellList
  | ShellClose
  | ShellOpen
  | ShellRestart
  | ShellTerminate
  | ShellResize
  | ShellRename;

export type ShellRequest = ShellMessage["request"];

export type ShellResponse = ShellMessage["response"];

export type ShellOutNotification = TNotification<
  "shell/out",
  {
    shellId: ShellId;
    out: string;
  }
>;

export type ShellCreateNotification = TNotification<"shell/create", ShellDTO>;

// Shell command finished (success or error)
export type ShellExitNotification = TNotification<
  "shell/exit",
  {
    shellId: ShellId;
    shellType: ShellProcessType;
    exitCode: number;
  }
>;

// Shell command was restarted
export type ShellRestartNotification = TNotification<
  "shell/restart",
  {
    shellId: ShellId;
  }
>;

// User killed shell
export type ShellTerminateNotification = TNotification<
  "shell/terminate",
  {
    shellId: ShellId;
    author: string;
  }
>;

export type ShellRenameNotification = TNotification<
  "shell/rename",
  {
    shell: ShellDTO;
  }
>;

export type ShellNotification =
  | ShellOutNotification
  | ShellCreateNotification
  | ShellRestartNotification
  | ShellExitNotification
  | ShellTerminateNotification
  | ShellRenameNotification;
