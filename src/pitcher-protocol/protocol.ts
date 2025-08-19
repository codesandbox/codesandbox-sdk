import { FsCapabilities } from "./messages/fs";
import { PitcherErrorCode } from "./errors";

export type ProtocolError = {
  code: PitcherErrorCode;
  data?: unknown;
  publicMessage?: string;
};

export type TMetadata = {
  clientId: string;
  permission: "read" | "write" | "owner";
};

export type TCapabilities = {
  fs: FsCapabilities | null;
};

export enum PitcherResponseStatus {
  RESOLVED = 0,
  REJECTED = 1,
}

export type TMessage<
  Method extends string,
  Params,
  Result extends {
    result: unknown;
    error: {
      code: PitcherErrorCode;
      data?: unknown;
      publicMessage?: string;
    };
  }
> = {
  request: {
    method: Method;
    params: Params;
  };
  response:
    | {
        method: Method;
        status: PitcherResponseStatus.RESOLVED;
        result: Result["result"];
      }
    | {
        method: Method;
        status: PitcherResponseStatus.REJECTED;
        error: Result["error"] & {
          message: string;
        };
      };
};

export type TNotification<Method extends string, Params> = {
  method: Method;
  params: Params;
};
