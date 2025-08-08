import { PitcherErrorCode } from "../errors";

import { ProtocolError, TMessage, TNotification } from "../protocol";

export type FsCapabilities = {
  reading: boolean;
  writing: boolean;
  watching: boolean;
};

export type FsServerCapabilities = {
  reading: boolean;
  watching: boolean;
  writing: boolean;
};

export type FsClientCapabilities = { [key: string]: unknown };

export type SearchResult = {
  fileId: string;
  lines: {
    text: string;
  };
  lineNumber: number;
  absoluteOffset: number;
  submatches: SearchSubMatch[];
};

export type StreamingSearchResult = {
  fileId?: string;
  filepath: string;
  lines: {
    text: string;
  };
  lineNumber: number;
  absoluteOffset: number;
  submatches: SearchSubMatch[];
};

export type SearchSubMatch = {
  match: {
    text: string;
  };
  start: number;
  end: number;
};

export type CommonError = ProtocolError;

export type InvalidIdError = {
  code: PitcherErrorCode.INVALID_ID;
};

export type RawFileSystemError = {
  code: PitcherErrorCode.RAWFS_ERROR;
  data: {
    errno: number | null;
  };
};

export interface FSSearchParams {
  text: string;
  glob?: string;
  isRegex?: boolean;
  caseSensitivity?: "smart" | "enabled" | "disabled";
}

export type FSSearchMessage = TMessage<
  "fs/search",
  FSSearchParams,
  {
    result: SearchResult[];
    error: CommonError;
  }
>;

export interface FSStreamingSearchParams {
  searchId: string;
  text: string;
  glob?: string;
  isRegex?: boolean;
  caseSensitivity?: "smart" | "enabled" | "disabled";
  /**
   * That default limit is 10_000 results
   */
  maxResults?: number;
}

export type FSStreamingSearchMessage = TMessage<
  "fs/streamingSearch",
  FSStreamingSearchParams,
  {
    result: {
      searchId: string;
    };
    error: CommonError;
  }
>;

export type FSCancelStreamingSearchMessage = TMessage<
  "fs/cancelStreamingSearch",
  {
    searchId: string;
  },
  {
    result: {
      searchId: string;
    };
    error: CommonError;
  }
>;

export interface PathSearchMatch {
  path: string;
  submatches: SearchSubMatch[];
}

export interface PathSearchResult {
  matches: PathSearchMatch[];
}

export interface PathSearchParams {
  text: string;
}

export type PathSearchMessage = TMessage<
  "fs/pathSearch",
  PathSearchParams,
  {
    result: PathSearchResult;
    error: CommonError;
  }
>;

export type FSUploadMessage = TMessage<
  "fs/upload",
  {
    parentId: string;
    filename: string;
    content: Uint8Array;
  },
  {
    result: {
      fileId: string;
    };
    error: CommonError | InvalidIdError;
  }
>;

export type FSDownloadMessage = TMessage<
  "fs/download",
  {
    path: string;
    /**
     * Glob patterns of files/folders to exclude from the download. Defaults to
     * *\*\/node_modules/\*\*.
     */
    excludes?: string[];
  },
  {
    result: {
      downloadUrl: string;
    };
    error: CommonError;
  }
>;

// #region RawFS

export type FSReadFileParams = {
  path: string;
};

export type FSReadFileResult = {
  content: Uint8Array;
};

export type FSReadFileMessage = TMessage<
  "fs/readFile",
  FSReadFileParams,
  {
    result: FSReadFileResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSReadDirParams = {
  path: string;
};

export type FSReadDirResult = {
  entries: {
    name: string;
    type: 0 | 1; // 0 = file, 1 = directory
    isSymlink: boolean;
  }[];
};

export type FSReadDirMessage = TMessage<
  "fs/readdir",
  FSReadDirParams,
  {
    result: FSReadDirResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSWriteFileParams = {
  path: string;
  content: Uint8Array;
  create?: boolean;
  overwrite?: boolean;
};

export type FSWRiteFileResult = Record<string, never>;

export type FSWriteFileMessage = TMessage<
  "fs/writeFile",
  FSWriteFileParams,
  {
    result: FSWRiteFileResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSStatParams = {
  path: string;
};

export type FSStatResult = {
  type: 0 | 1; // 0 = file, 1 = directory
  isSymlink: boolean;
  size: number;
  mtime: number;
  ctime: number;
  atime: number;
};

export type FSStatMessage = TMessage<
  "fs/stat",
  FSStatParams,
  {
    result: FSStatResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSCopyParams = {
  from: string;
  to: string;
  recursive?: boolean;
  overwrite?: boolean;
};

export type FSCopyResult = Record<string, never>;

export type FSCopyMessage = TMessage<
  "fs/copy",
  FSCopyParams,
  {
    result: FSCopyResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSRenameParams = {
  from: string;
  to: string;
  overwrite?: boolean;
};

export type FSRenameResult = Record<string, never>;

export type FSRenameMessage = TMessage<
  "fs/rename",
  FSRenameParams,
  {
    result: FSRenameResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSRemoveParams = {
  path: string;
  recursive?: boolean;
};

export type FSRemoveResult = Record<string, never>;

export type FSRemoveMessage = TMessage<
  "fs/remove",
  FSRemoveParams,
  {
    result: FSRemoveResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSMkdirParams = {
  path: string;
  recursive?: boolean;
};

export type FSMkdirResult = Record<string, never>;

export type FSMkdirMessage = TMessage<
  "fs/mkdir",
  FSMkdirParams,
  {
    result: FSMkdirResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSWatchParams = {
  path: string;
  recursive?: boolean;
  excludes?: string[];
};

export type FSWatchResult = {
  watchId: string;
};

export type FSWatchMessage = TMessage<
  "fs/watch",
  FSWatchParams,
  {
    result: FSWatchResult;
    error: CommonError | RawFileSystemError;
  }
>;

export type FSUnwatchParams = {
  watchId: string;
};

export type FSUnwatchResult = Record<string, never>;

export type FSUnwatchMessage = TMessage<
  "fs/unwatch",
  FSUnwatchParams,
  {
    result: FSUnwatchResult;
    error: CommonError | RawFileSystemError;
  }
>;

type RawFsMessage =
  | FSReadFileMessage
  | FSReadDirMessage
  | FSWriteFileMessage
  | FSStatMessage
  | FSCopyMessage
  | FSRenameMessage
  | FSRemoveMessage
  | FSMkdirMessage
  | FSWatchMessage
  | FSUnwatchMessage;

// #endregion

type FsMessage =
  | FSSearchMessage
  | FSStreamingSearchMessage
  | FSCancelStreamingSearchMessage
  | PathSearchMessage
  | FSUploadMessage
  | FSDownloadMessage
  | RawFsMessage;

export type FsRequest = FsMessage["request"];

export type FsResponse = FsMessage["response"];

export interface FSWatchEvent {
  paths: string[];
  type: "add" | "change" | "remove";
}

/**
 * Listen for tree operations reflecting filesystem operations made by
 * other clients
 */

export type FSWatchNotifiction = TNotification<
  "fs/watchEvent",
  {
    watchId: string;
    events: FSWatchEvent[];
  }
>;

export type FSSearchMatchesNotifiction = TNotification<
  "fs/searchMatches",
  {
    searchId: string;
    matches: StreamingSearchResult[];
  }
>;

export type FSSearchFinishedNotifiction = TNotification<
  "fs/searchFinished",
  {
    searchId: string;
    hitLimit: boolean;
  }
>;

export type FsNotification =
  | FSWatchNotifiction
  | FSSearchMatchesNotifiction
  | FSSearchFinishedNotifiction;
