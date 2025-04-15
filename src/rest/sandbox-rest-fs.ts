import { Client } from "@hey-api/client-fetch";
import * as fs from "../clients/client-rest-fs";
import { SessionData } from "../sessions";
import { join } from "path";
import { getSessionUrl } from "../utils/session";

export class SandboxRestFS {
  constructor(private client: Client) {}
  private createRestParams<T>(session: SessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }
  writeTextFile(
    session: SessionData,
    body: Omit<fs.WriteFileData["body"], "content"> & { content: string }
  ) {
    return fs.writeFile(
      this.createRestParams(session, {
        ...body,
        // OpenAPI does not have UINT8Array, so we need to cast it to a Blob
        content: new TextEncoder().encode(body.content) as unknown as Blob,
        path: join(session.user_workspace_path, body.path),
        create: body.create === false ? false : true,
      })
    );
  }
  writeFile(session: SessionData, body: fs.WriteFileData["body"]) {
    return fs.writeFile(
      this.createRestParams(session, {
        ...body,
        path: join(session.user_workspace_path, body.path),
        create: body.create === false ? false : true,
      })
    );
  }
  readFile(session: SessionData, body: fs.FsReadFileData["body"]) {
    return fs.fsReadFile(
      this.createRestParams(session, {
        ...body,
        path: join(session.user_workspace_path, body.path),
      })
    );
  }
  search(session: SessionData, body: fs.FsSearchData["body"]) {
    return fs.fsSearch(this.createRestParams(session, body));
  }
  pathSearch(session: SessionData, body: fs.FsPathSearchData["body"]) {
    return fs.fsPathSearch(this.createRestParams(session, body));
  }
  upload(session: SessionData, body: fs.FsUploadData["body"]) {
    return fs.fsUpload(this.createRestParams(session, body));
  }
  download(session: SessionData, body: fs.FsDownloadData["body"]) {
    return fs.fsDownload(this.createRestParams(session, body));
  }
  readDir(session: SessionData, body: fs.FsReadDirData["body"]) {
    return fs.fsReadDir(
      this.createRestParams(session, {
        ...body,
        path: join(session.user_workspace_path, body.path),
      })
    );
  }
  stat(session: SessionData, body: fs.FsStatData["body"]) {
    return fs.fsStat(
      this.createRestParams(session, {
        ...body,
        path: join(session.user_workspace_path, body.path),
      })
    );
  }
  copy(session: SessionData, body: fs.FsCopyData["body"]) {
    return fs.fsCopy(
      this.createRestParams(session, {
        ...body,
        from: join(session.user_workspace_path, body.from),
        to: join(session.user_workspace_path, body.to),
      })
    );
  }
  rename(session: SessionData, body: fs.FsRenameData["body"]) {
    return fs.fsRename(
      this.createRestParams(session, {
        ...body,
        from: join(session.user_workspace_path, body.from),
        to: join(session.user_workspace_path, body.to),
      })
    );
  }
  remove(session: SessionData, body: fs.FsRemoveData["body"]) {
    return fs.fsRemove(
      this.createRestParams(session, {
        ...body,
        path: join(session.user_workspace_path, body.path),
      })
    );
  }
  mkdir(session: SessionData, body: fs.FsMkdirData["body"]) {
    return fs.fsMkdir(
      this.createRestParams(session, {
        ...body,
        path: join(session.user_workspace_path, body.path),
      })
    );
  }
}
