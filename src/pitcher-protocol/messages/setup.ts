import { ProtocolError, TMessage, TNotification } from "../protocol";
import { Id } from "@codesandbox/pitcher-common";

export interface Step {
  name: string;
  command: string;
  shellId: Id | null;
  finishStatus: SetupShellStatus | null;
}

export type SetupShellStatus = "SUCCEEDED" | "FAILED" | "SKIPPED";

export interface SetupProgress {
  state: "IDLE" | "IN_PROGRESS" | "FINISHED" | "STOPPED";
  steps: Step[];
  currentStepIndex: number;
}

export type SetupGetMessage = TMessage<
  "setup/get",
  Record<string, never>,
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

export type SetupSkipStep = TMessage<
  "setup/skip",
  { stepIndexToSkip: number },
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

export type SetupSkipAll = TMessage<
  "setup/skipAll",
  null,
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

export type SetupDisable = TMessage<
  "setup/disable",
  null,
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

export type SetupEnable = TMessage<
  "setup/enable",
  null,
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

export type SetupInit = TMessage<
  "setup/init",
  null,
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

/**
 * Set the current step. This is used to restart the process, for example.
 */
export type SetupSetStep = TMessage<
  "setup/setStep",
  { stepIndex: number },
  {
    result: SetupProgress;
    error: ProtocolError;
  }
>;

type SetupMessage =
  | SetupGetMessage
  | SetupSkipStep
  | SetupSkipAll
  | SetupSetStep
  | SetupDisable
  | SetupEnable
  | SetupInit;

export type SetupRequest = SetupMessage["request"];

export type SetupResponse = SetupMessage["response"];

export type SetupStatusNotification = TNotification<
  "setup/progress",
  SetupProgress
>;

export type SetupNotification = SetupStatusNotification;
