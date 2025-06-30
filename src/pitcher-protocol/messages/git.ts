import { ProtocolError, TMessage, TNotification } from "../protocol";
import { Id } from "@codesandbox/pitcher-common";

import { PitcherErrorCode } from "../errors";

// See https://git-scm.com/docs/git-status#_short_format
export enum GitStatusShortFormat {
  UnModified = "",
  Modified = "M",
  Added = "A",
  Deleted = "D",
  Renamed = "R",
  Copied = "C",
  /**
   * Updated but not merged
   */
  Updated = "U",
  /**
   * New files that have never been committed before
   */
  Untracked = "?",
}

export interface GitItem {
  path: string;
  index: GitStatusShortFormat;
  workingTree: GitStatusShortFormat;
  isStaged: boolean;
  isConflicted: boolean;
  fileId?: Id;
}

export type GitChangedFiles = {
  [fileId: string]: GitItem;
};

export interface GitBranchProperties {
  head: string | null;
  branch: string | null;
  ahead: number;
  behind: number;
  safe: boolean;
}

export interface GitStatus {
  changedFiles: GitChangedFiles;
  deletedFiles: GitItem[];
  conflicts: boolean; // remote conflicts, we are exploring how to get these from target
  localChanges: boolean;
  remote: GitBranchProperties;
  target: GitBranchProperties;
  head?: string;
  commits: GitCommit[]; // Might be revisited if the payload is too big
  branch: string | null;
  isMerging: boolean;
}

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export interface GitTargetDiff {
  ahead: number;
  behind: number;
  commits: GitCommit[];
}

export type CommonError =
  | {
      code:
        | PitcherErrorCode.GIT_OPERATION_IN_PROGRESS
        | PitcherErrorCode.GIT_REMOTE_FILE_NOT_FOUND;
      message: string;
    }
  | ProtocolError;

export type GitStatusMessage = TMessage<
  "git/status",
  Record<string, never>,
  {
    result: GitStatus;
    error: CommonError;
  }
>;

export interface GitRemotes {
  origin: string;
  upstream: string;
}

export type GitRemotesMessage = TMessage<
  "git/remotes",
  Record<string, never>,
  {
    result: GitRemotes;
    error: CommonError;
  }
>;

export type GitTargetDiffMessage = TMessage<
  "git/targetDiff",
  { branch: string },
  { result: GitTargetDiff; error: CommonError }
>;

export type GitPullMessage = TMessage<
  "git/pull",
  { branch?: string; force?: boolean },
  { result: null; error: CommonError }
>;

export type GitDiscardChangesMessage = TMessage<
  "git/discard",
  { paths?: string[] },
  { result: { paths?: string[] }; error: CommonError }
>;

export type GitCommitMessage = TMessage<
  "git/commit",
  { paths?: string[]; message: string; push?: boolean },
  {
    result: {
      shellId: Id;
    };
    error: CommonError;
  }
>;

export type GitPushMessage = TMessage<
  "git/push",
  null,
  {
    result: null;
    error: CommonError;
  }
>;

export type GitPushToRemoteMessage = TMessage<
  "git/pushToRemote",
  { url: string; branch: string; squashAllCommits?: boolean },
  { result: null; error: CommonError }
>;

export type GitRenameBranchMessage = TMessage<
  "git/renameBranch",
  { oldBranch: string; newBranch: string },
  { result: null; error: CommonError }
>;

export interface GitRemoteParams {
  /** branch or commit hash */
  reference: string;
  path: string;
}

export type GitRemoteContentMessage = TMessage<
  "git/remoteContent",
  GitRemoteParams,
  {
    result: {
      content: string;
    };
    error: CommonError;
  }
>;

export interface GitDiffStatusParams {
  /**
   * Base reference used for diffing,
   * Can be any valid git reference: commit, HEAD, branch-name, tag, ...
   * executed like "git diff base..head"
   **/
  base: string;
  /**
   * Head reference used for diffing,
   * Can be any valid git reference: commit, HEAD, branch-name, tag, ...
   * executed like "git diff base..head"
   **/
  head: string;
}

export interface GitDiffStatusItem {
  status: GitStatusShortFormat;
  path: string;
  oldPath?: string;
  hunks: Array<{
    original: { start: number; end: number };
    modified: { start: number; end: number };
  }>;
}

export interface GitDiffStatusResult {
  files: GitDiffStatusItem[];
}

export type GitDiffStatusMessage = TMessage<
  "git/diffStatus",
  GitDiffStatusParams,
  {
    result: GitDiffStatusResult;
    error: CommonError;
  }
>;

export type GitResetLocalWithRemote = TMessage<
  "git/resetLocalWithRemote",
  Record<string, never>,
  {
    result: null;
    error: CommonError;
  }
>;

export type GitCheckoutInitialBranch = TMessage<
  "git/checkoutInitialBranch",
  Record<string, never>,
  { result: null; error: CommonError }
>;

export type GitTransposeLines = TMessage<
  "git/transposeLines",
  Array<{ sha: string; path: string; line: number }>,
  {
    result: Array<{ path: string; line: number } | null>;
    error: CommonError;
  }
>;

type GitMessage =
  | GitPushToRemoteMessage
  | GitStatusMessage
  | GitTargetDiffMessage
  | GitPullMessage
  | GitDiscardChangesMessage
  | GitCommitMessage
  | GitRenameBranchMessage
  | GitRemoteContentMessage
  | GitDiffStatusMessage
  | GitRemotesMessage
  | GitResetLocalWithRemote
  | GitPushMessage
  | GitCheckoutInitialBranch
  | GitTransposeLines;

export type GitRequest = GitMessage["request"];

export type GitResponse = GitMessage["response"];

export type GitStatusNotification = TNotification<"git/status", GitStatus>;

export type GitPullStartedNotification = TNotification<"git/pullStarted", null>;

export type GitPullFinishedNotification = TNotification<
  "git/pullFinished",
  null | {
    exitCode: 1;
    error: CommonError;
  }
>;

export type GitCommitStartedNotification = TNotification<
  "git/commitStarted",
  {
    shellId: Id;
    message: string;
    paths?: string[];
  }
>;

export type GitCommitFinishedNotification = TNotification<
  "git/commitFinished",
  {
    exitCode: 0 | 1;
  }
>;

/**
 * Our VMs are currently bound to the dedicated branch. We prevent users from changing the branch manually,
 * but notify when it happens so the clients can act accordingly
 */
export type GitCheckoutBranchNotification = TNotification<
  "git/checkoutPrevented",
  {
    branch: string | null;
  }
>;

export type GitRenameBranchNotification = TNotification<
  "git/renameBranch",
  { oldBranch: string; newBranch: string }
>;

export type GitRemotesNotification = TNotification<"git/remotes", GitRemotes>;

export type GitNotification =
  | GitStatusNotification
  | GitPullStartedNotification
  | GitPullFinishedNotification
  | GitCommitStartedNotification
  | GitCommitFinishedNotification
  | GitRenameBranchNotification
  | GitRemotesNotification
  | GitCheckoutBranchNotification;
