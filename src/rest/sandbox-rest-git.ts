import { Client } from "@hey-api/client-fetch";
import * as git from "../clients/client-rest-git";
import { SessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestGit {
  constructor(private client: Client) {}
  private createRestParams<T>(session: SessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  status(session: SessionData, body: git.GitStatusData["body"]) {
    return git.gitStatus(this.createRestParams(session, body));
  }

  remotes(session: SessionData, body: git.GitRemotesData["body"]) {
    return git.gitRemotes(this.createRestParams(session, body));
  }

  targetDiff(session: SessionData, body: git.GitTargetDiffData["body"]) {
    return git.gitTargetDiff(this.createRestParams(session, body));
  }

  pull(session: SessionData, body: git.GitPullData["body"]) {
    return git.gitPull(this.createRestParams(session, body));
  }

  discard(session: SessionData, body: git.GitDiscardData["body"]) {
    return git.gitDiscard(this.createRestParams(session, body));
  }

  commit(session: SessionData, body: git.GitCommitData["body"]) {
    return git.gitCommit(this.createRestParams(session, body));
  }

  push(session: SessionData, body: git.GitPushData["body"]) {
    return git.gitPush(this.createRestParams(session, body));
  }

  pushToRemote(session: SessionData, body: git.GitPushToRemoteData["body"]) {
    return git.gitPushToRemote(this.createRestParams(session, body));
  }

  renameBranch(session: SessionData, body: git.GitRenameBranchData["body"]) {
    return git.gitRenameBranch(this.createRestParams(session, body));
  }

  remoteContent(session: SessionData, body: git.GitRemoteContentData["body"]) {
    return git.gitRemoteContent(this.createRestParams(session, body));
  }

  diffStatus(session: SessionData, body: git.GitDiffStatusData["body"]) {
    return git.gitDiffStatus(this.createRestParams(session, body));
  }

  resetLocalWithRemote(
    session: SessionData,
    body: git.GitResetLocalWithRemoteData["body"]
  ) {
    return git.gitResetLocalWithRemote(this.createRestParams(session, body));
  }
}
