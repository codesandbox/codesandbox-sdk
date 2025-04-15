// This file is auto-generated by @hey-api/openapi-ts

export type SuccessResponse = {
    /**
     * Status code for successful operations
     */
    status: 0;
    /**
     * Result payload for the operation
     */
    result: {
        [key: string]: unknown;
    };
};

export type ErrorResponse = {
    /**
     * Status code for error operations
     */
    status: 1;
    /**
     * Error details
     */
    error: {
        [key: string]: unknown;
    };
};

export type CommonError = {
    /**
     * Error code
     */
    code: 'GIT_OPERATION_IN_PROGRESS' | 'GIT_REMOTE_FILE_NOT_FOUND';
    /**
     * Error message
     */
    message: string;
} | {
    /**
     * Protocol error code
     */
    code: string;
    /**
     * Error message
     */
    message: string;
    /**
     * Additional error data
     */
    data?: {
        [key: string]: unknown;
    };
};

/**
 * Git status short format codes
 */
export type GitStatusShortFormat = '' | 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '?';

export type GitItem = {
    /**
     * File path
     */
    path: string;
    index: GitStatusShortFormat;
    workingTree: GitStatusShortFormat;
    /**
     * Whether the file is staged
     */
    isStaged: boolean;
    /**
     * Whether the file has conflicts
     */
    isConflicted: boolean;
    /**
     * Unique identifier for the file
     */
    fileId?: string;
};

/**
 * Map of file IDs to Git items
 */
export type GitChangedFiles = {
    [key: string]: GitItem;
};

export type GitBranchProperties = {
    /**
     * Current HEAD reference
     */
    head?: unknown;
    /**
     * Current branch name
     */
    branch?: unknown;
    /**
     * Number of commits ahead of the remote
     */
    ahead: number;
    /**
     * Number of commits behind the remote
     */
    behind: number;
    /**
     * Whether the branch is safe to operate on
     */
    safe: boolean;
};

export type GitCommit = {
    /**
     * Commit hash
     */
    hash: string;
    /**
     * Commit date
     */
    date: string;
    /**
     * Commit message
     */
    message: string;
    /**
     * Commit author
     */
    author: string;
};

export type GitStatus = {
    changedFiles: GitChangedFiles;
    deletedFiles: Array<GitItem>;
    /**
     * Whether there are remote conflicts
     */
    conflicts: boolean;
    /**
     * Whether there are local changes
     */
    localChanges: boolean;
    remote: GitBranchProperties;
    target: GitBranchProperties;
    /**
     * Current HEAD reference
     */
    head?: string;
    commits: Array<GitCommit>;
    /**
     * Current branch name
     */
    branch: unknown;
    /**
     * Whether a merge is in progress
     */
    isMerging: boolean;
};

export type GitTargetDiff = {
    /**
     * Number of commits ahead of the target
     */
    ahead: number;
    /**
     * Number of commits behind the target
     */
    behind: number;
    commits: Array<GitCommit>;
};

export type GitRemotes = {
    /**
     * Origin remote URL
     */
    origin: string;
    /**
     * Upstream remote URL
     */
    upstream: string;
};

export type GitRemoteParams = {
    /**
     * Branch or commit hash
     */
    reference: string;
    /**
     * Path to the file
     */
    path: string;
};

export type GitDiffStatusParams = {
    /**
     * Base reference used for diffing
     */
    base: string;
    /**
     * Head reference used for diffing
     */
    head: string;
};

export type GitDiffStatusItem = {
    status: GitStatusShortFormat;
    /**
     * Path to the file
     */
    path: string;
    /**
     * Original path for renamed files
     */
    oldPath?: string;
    hunks: Array<{
        original: {
            start: number;
            end: number;
        };
        modified: {
            start: number;
            end: number;
        };
    }>;
};

export type GitDiffStatusResult = {
    files: Array<GitDiffStatusItem>;
};

export type GitStatusData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/git/status';
};

export type GitStatusErrors = {
    /**
     * Error retrieving git status
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitStatusError = GitStatusErrors[keyof GitStatusErrors];

export type GitStatusResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: GitStatus;
    };
};

export type GitStatusResponse = GitStatusResponses[keyof GitStatusResponses];

export type GitRemotesData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/git/remotes';
};

export type GitRemotesErrors = {
    /**
     * Error retrieving git remotes
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitRemotesError = GitRemotesErrors[keyof GitRemotesErrors];

export type GitRemotesResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: GitRemotes;
    };
};

export type GitRemotesResponse = GitRemotesResponses[keyof GitRemotesResponses];

export type GitTargetDiffData = {
    body: {
        /**
         * Branch to compare against
         */
        branch: string;
    };
    path?: never;
    query?: never;
    url: '/git/targetDiff';
};

export type GitTargetDiffErrors = {
    /**
     * Error retrieving git target diff
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitTargetDiffError = GitTargetDiffErrors[keyof GitTargetDiffErrors];

export type GitTargetDiffResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: GitTargetDiff;
    };
};

export type GitTargetDiffResponse = GitTargetDiffResponses[keyof GitTargetDiffResponses];

export type GitPullData = {
    body: {
        /**
         * Branch to pull from
         */
        branch?: string;
        /**
         * Force pull even if there are conflicts
         */
        force?: boolean;
    };
    path?: never;
    query?: never;
    url: '/git/pull';
};

export type GitPullErrors = {
    /**
     * Error pulling from remote
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitPullError = GitPullErrors[keyof GitPullErrors];

export type GitPullResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type GitPullResponse = GitPullResponses[keyof GitPullResponses];

export type GitDiscardData = {
    body: {
        /**
         * Paths of files to discard changes
         */
        paths?: Array<string>;
    };
    path?: never;
    query?: never;
    url: '/git/discard';
};

export type GitDiscardErrors = {
    /**
     * Error discarding changes
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitDiscardError = GitDiscardErrors[keyof GitDiscardErrors];

export type GitDiscardResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: {
            paths?: Array<string>;
        };
    };
};

export type GitDiscardResponse = GitDiscardResponses[keyof GitDiscardResponses];

export type GitCommitData = {
    body: {
        /**
         * Paths of files to commit
         */
        paths?: Array<string>;
        /**
         * Commit message
         */
        message: string;
        /**
         * Whether to push the commit immediately
         */
        push?: boolean;
    };
    path?: never;
    query?: never;
    url: '/git/commit';
};

export type GitCommitErrors = {
    /**
     * Error committing changes
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitCommitError = GitCommitErrors[keyof GitCommitErrors];

export type GitCommitResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: {
            /**
             * ID of the shell process
             */
            shellId: string;
        };
    };
};

export type GitCommitResponse = GitCommitResponses[keyof GitCommitResponses];

export type GitPushData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/git/push';
};

export type GitPushErrors = {
    /**
     * Error pushing changes
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitPushError = GitPushErrors[keyof GitPushErrors];

export type GitPushResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type GitPushResponse = GitPushResponses[keyof GitPushResponses];

export type GitPushToRemoteData = {
    body: {
        /**
         * URL of the remote repository
         */
        url: string;
        /**
         * Branch to push to
         */
        branch: string;
        /**
         * Whether to squash all commits into one
         */
        squashAllCommits?: boolean;
    };
    path?: never;
    query?: never;
    url: '/git/pushToRemote';
};

export type GitPushToRemoteErrors = {
    /**
     * Error pushing to remote
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitPushToRemoteError = GitPushToRemoteErrors[keyof GitPushToRemoteErrors];

export type GitPushToRemoteResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type GitPushToRemoteResponse = GitPushToRemoteResponses[keyof GitPushToRemoteResponses];

export type GitRenameBranchData = {
    body: {
        /**
         * Current branch name
         */
        oldBranch: string;
        /**
         * New branch name
         */
        newBranch: string;
    };
    path?: never;
    query?: never;
    url: '/git/renameBranch';
};

export type GitRenameBranchErrors = {
    /**
     * Error renaming branch
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitRenameBranchError = GitRenameBranchErrors[keyof GitRenameBranchErrors];

export type GitRenameBranchResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type GitRenameBranchResponse = GitRenameBranchResponses[keyof GitRenameBranchResponses];

export type GitRemoteContentData = {
    body: GitRemoteParams;
    path?: never;
    query?: never;
    url: '/git/remoteContent';
};

export type GitRemoteContentErrors = {
    /**
     * Error retrieving remote content
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitRemoteContentError = GitRemoteContentErrors[keyof GitRemoteContentErrors];

export type GitRemoteContentResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: {
            /**
             * Content of the file
             */
            content: string;
        };
    };
};

export type GitRemoteContentResponse = GitRemoteContentResponses[keyof GitRemoteContentResponses];

export type GitDiffStatusData = {
    body: GitDiffStatusParams;
    path?: never;
    query?: never;
    url: '/git/diffStatus';
};

export type GitDiffStatusErrors = {
    /**
     * Error retrieving diff status
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitDiffStatusError = GitDiffStatusErrors[keyof GitDiffStatusErrors];

export type GitDiffStatusResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: GitDiffStatusResult;
    };
};

export type GitDiffStatusResponse = GitDiffStatusResponses[keyof GitDiffStatusResponses];

export type GitResetLocalWithRemoteData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/git/resetLocalWithRemote';
};

export type GitResetLocalWithRemoteErrors = {
    /**
     * Error resetting local with remote
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitResetLocalWithRemoteError = GitResetLocalWithRemoteErrors[keyof GitResetLocalWithRemoteErrors];

export type GitResetLocalWithRemoteResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type GitResetLocalWithRemoteResponse = GitResetLocalWithRemoteResponses[keyof GitResetLocalWithRemoteResponses];

export type GitCheckoutInitialBranchData = {
    body: {
        [key: string]: unknown;
    };
    path?: never;
    query?: never;
    url: '/git/checkoutInitialBranch';
};

export type GitCheckoutInitialBranchErrors = {
    /**
     * Error checking out initial branch
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitCheckoutInitialBranchError = GitCheckoutInitialBranchErrors[keyof GitCheckoutInitialBranchErrors];

export type GitCheckoutInitialBranchResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: unknown;
    };
};

export type GitCheckoutInitialBranchResponse = GitCheckoutInitialBranchResponses[keyof GitCheckoutInitialBranchResponses];

export type GitTransposeLinesData = {
    body: Array<{
        /**
         * Git commit SHA
         */
        sha: string;
        /**
         * Path to the file
         */
        path: string;
        /**
         * Line number to transpose
         */
        line: number;
    }>;
    path?: never;
    query?: never;
    url: '/git/transposeLines';
};

export type GitTransposeLinesErrors = {
    /**
     * Error transposing lines
     */
    400: ErrorResponse & {
        error?: CommonError;
    };
};

export type GitTransposeLinesError = GitTransposeLinesErrors[keyof GitTransposeLinesErrors];

export type GitTransposeLinesResponses = {
    /**
     * Successful operation
     */
    200: SuccessResponse & {
        result?: Array<{
            path: string;
            line: number;
        } | unknown>;
    };
};

export type GitTransposeLinesResponse = GitTransposeLinesResponses[keyof GitTransposeLinesResponses];