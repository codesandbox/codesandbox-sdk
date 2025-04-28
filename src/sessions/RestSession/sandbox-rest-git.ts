import { Client } from "@hey-api/client-fetch";
import * as git from "../../clients/client-rest-git";

export class SandboxRestGit {
  constructor(private client: Client) {}
  status(body: git.GitStatusData["body"]) {
    return git.gitStatus({ client: this.client, body });
  }

  remotes(body: git.GitRemotesData["body"]) {
    return git.gitRemotes({ client: this.client, body });
  }

  targetDiff(body: git.GitTargetDiffData["body"]) {
    return git.gitTargetDiff({ client: this.client, body });
  }

  pull(body: git.GitPullData["body"]) {
    return git.gitPull({ client: this.client, body });
  }

  discard(body: git.GitDiscardData["body"]) {
    return git.gitDiscard({ client: this.client, body });
  }

  commit(body: git.GitCommitData["body"]) {
    return git.gitCommit({ client: this.client, body });
  }

  push(body: git.GitPushData["body"]) {
    return git.gitPush({ client: this.client, body });
  }

  pushToRemote(body: git.GitPushToRemoteData["body"]) {
    return git.gitPushToRemote({ client: this.client, body });
  }

  renameBranch(body: git.GitRenameBranchData["body"]) {
    return git.gitRenameBranch({ client: this.client, body });
  }

  remoteContent(body: git.GitRemoteContentData["body"]) {
    return git.gitRemoteContent({ client: this.client, body });
  }

  diffStatus(body: git.GitDiffStatusData["body"]) {
    return git.gitDiffStatus({ client: this.client, body });
  }

  resetLocalWithRemote(body: git.GitResetLocalWithRemoteData["body"]) {
    return git.gitResetLocalWithRemote({ client: this.client, body });
  }
}
