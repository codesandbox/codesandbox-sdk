import { Id, ot } from "@codesandbox/pitcher-common";
import { PitcherErrorCode } from "../errors";

import { ProtocolError, TMessage, TNotification } from "../protocol";

export type IRangeObject = {
  anchor: number;
  head: number;
};

export enum SelectionsUpdateReason {
  CONTENT_CHANGE = 0,
  SELECTION = 1,
  CLIENT_LEFT = 2,
}

export type ISelection = IRangeObject[];

export interface IDocumentSelections {
  [clientId: string]: ISelection | null;
}

export interface IDocumentClients {
  [clientId: string]: ISelection | null;
}

export interface IDocumentObject {
  clients: IDocumentClients;
  revision: number;
}

export interface IFileClients {
  [clientId: string]: {
    username: string;
  };
}

export interface IFileObject {
  id: Id;
  isBinary: boolean;
  content: Uint8Array | string;
  document: IDocumentObject | null;
  savedHash: string;
  clients: IFileClients;
}

export type CommonError = ProtocolError;

export type InvalidIdError = {
  code: PitcherErrorCode.INVALID_ID;
};

export type InvalidPathError = {
  code: PitcherErrorCode.INVALID_PATH;
};

/**
 * Opens a new collaborative text document
 */
export type OpenFile = TMessage<
  "file/open",
  {
    id: Id;
    isResync?: boolean;
  },
  {
    result: IFileObject;
    error: InvalidIdError | CommonError;
  }
>;

/**
 * Opens a new collaborative text document
 */
export type OpenFileByPath = TMessage<
  "file/openByPath",
  {
    path: string;
    isResync?: boolean;
  },
  {
    result: IFileObject;
    error: InvalidIdError | InvalidPathError | CommonError;
  }
>;

/**
 * Client acknowledges receiving a revision, so Pitcher
 * can keep track of what revisions each client is on
 */
export type AckDocument = TMessage<
  "file/documentAck",
  {
    id: Id;
    revision: number;
  },
  {
    result: {
      revision: number;
    };
    error: InvalidIdError | CommonError;
  }
>;

/**
 * Closes a file, which is disposed
 * when last user closes it
 */
export type CloseFile = TMessage<
  "file/close",
  {
    id: Id;
  },
  {
    result: null;
    error: InvalidIdError | CommonError;
  }
>;

/**
 * Saves the document to disk when all clients are at
 * revision to save
 */
export type SaveFile = TMessage<
  "file/save",
  {
    id: Id;
    /**
     * Whether the document should be written to disk
     */
    write?: boolean;
  },
  {
    result: null;
    error: InvalidIdError | CommonError;
  }
>;

/**
 * OT operation to make change to document
 */
export type DocumentOperation = TMessage<
  "file/documentOperation",
  {
    id: Id;
    operation: ot.JSONTextOperation;
    revision: number;
  },
  {
    result: {
      id: Id;
      revision: number;
    };
    error: InvalidIdError | CommonError;
  }
>;

/**
 * Client acknowledges receiving a revision, so Pitcher
 * can keep track of what revisions each client is on
 */
export type DocumentSelection = TMessage<
  "file/documentSelection",
  {
    id: Id;
    selection: ISelection;
    /**
     * Passing the selection reason allows for clients to separate selections, where
     * for example Monaco/VSCode will filter out selections by CONTENT_CHANGE as they
     * automatically transform selections with text operations
     *
     * NOTE! Will become a required property in later BREAKING version
     */
    reason?: SelectionsUpdateReason;
  },
  {
    result: null;
    error: InvalidIdError | CommonError;
  }
>;

type FileMessage =
  | OpenFile
  | OpenFileByPath
  | CloseFile
  | AckDocument
  | SaveFile
  | DocumentOperation
  | DocumentSelection;

export type FileRequest = FileMessage["request"];

export type FileResponse = FileMessage["response"];

export type JoinFileNotification = TNotification<
  "file/join",
  {
    id: Id;
    isBinary: boolean;
    clientId: string;
    username: string;
  }
>;

export type LeaveFileNotification = TNotification<
  "file/leave",
  {
    id: Id;
    isBinary: boolean;
    clientId: string;
    username: string;
  }
>;

export type SaveFileNotification = TNotification<
  "file/save",
  {
    id: Id;
    isBinary: boolean;
    content: string | Uint8Array;
    savedHash: string;
  }
>;

export type DocumentOperationNotification = TNotification<
  "file/documentOperation",
  {
    id: Id;
    operation: ot.JSONTextOperation;
    revision: number;
    reason: ot.OperationReason;
  }
>;

export type DocumentSelectionNotification = TNotification<
  "file/documentSelection",
  {
    id: Id;
    selections: IDocumentSelections;
    reason?: SelectionsUpdateReason;
  }
>;

export type FileNotification =
  | JoinFileNotification
  | LeaveFileNotification
  | SaveFileNotification
  | DocumentOperationNotification
  | DocumentSelectionNotification;
