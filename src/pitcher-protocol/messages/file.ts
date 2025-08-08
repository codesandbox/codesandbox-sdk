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
  id: string;
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
    id: string;
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
 * Closes a file, which is disposed
 * when last user closes it
 */
export type CloseFile = TMessage<
  "file/close",
  {
    id: string;
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
    id: string;
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

type FileMessage = OpenFile | OpenFileByPath | CloseFile | SaveFile;

export type FileRequest = FileMessage["request"];

export type FileResponse = FileMessage["response"];

export type JoinFileNotification = TNotification<
  "file/join",
  {
    id: string;
    isBinary: boolean;
    clientId: string;
    username: string;
  }
>;

export type LeaveFileNotification = TNotification<
  "file/leave",
  {
    id: string;
    isBinary: boolean;
    clientId: string;
    username: string;
  }
>;

export type SaveFileNotification = TNotification<
  "file/save",
  {
    id: string;
    isBinary: boolean;
    content: string | Uint8Array;
    savedHash: string;
  }
>;

export type FileNotification =
  | JoinFileNotification
  | LeaveFileNotification
  | SaveFileNotification;
