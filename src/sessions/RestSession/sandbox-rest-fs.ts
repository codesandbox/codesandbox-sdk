import { Client } from "@hey-api/client-fetch";
import * as fs from "../../clients/client-rest-fs";
import { join } from "path";

import { SandboxSession } from "../../types";

export class SandboxRestFS {
  constructor(private session: SandboxSession, private client: Client) {}
  writeTextFile(
    body: Omit<fs.WriteFileData["body"], "content"> & { content: string }
  ) {
    return fs.writeFile({
      client: this.client,
      body: {
        ...body,
        // OpenAPI does not have UINT8Array, so we need to cast it to a Blob
        content: new TextEncoder().encode(body.content) as unknown as Blob,
        path: join(this.session.userWorkspacePath, body.path),
        create: body.create === false ? false : true,
        overwrite: body.overwrite === false ? false : true,
      },
    });
  }
  writeFile(body: fs.WriteFileData["body"]) {
    return fs.writeFile({
      client: this.client,
      body: {
        ...body,
        path: join(this.session.userWorkspacePath, body.path),
        create: body.create === false ? false : true,
      },
    });
  }
  readFile(body: fs.FsReadFileData["body"]) {
    return fs.fsReadFile({
      client: this.client,
      body: {
        ...body,
        path: join(this.session.userWorkspacePath, body.path),
      },
    });
  }
  search(body: fs.FsSearchData["body"]) {
    return fs.fsSearch({ client: this.client, body });
  }
  pathSearch(body: fs.FsPathSearchData["body"]) {
    return fs.fsPathSearch({ client: this.client, body });
  }
  upload(body: fs.FsUploadData["body"]) {
    return fs.fsUpload({ client: this.client, body });
  }
  download(body: fs.FsDownloadData["body"]) {
    return fs.fsDownload({ client: this.client, body });
  }
  readDir(body: fs.FsReadDirData["body"]) {
    return fs.fsReadDir({
      client: this.client,
      body: {
        ...body,
        path: join(this.session.userWorkspacePath, body.path),
      },
    });
  }
  stat(body: fs.FsStatData["body"]) {
    return fs.fsStat({
      client: this.client,
      body: {
        ...body,
        path: join(this.session.userWorkspacePath, body.path),
      },
    });
  }
  copy(body: fs.FsCopyData["body"]) {
    return fs.fsCopy({
      client: this.client,
      body: {
        ...body,
        from: join(this.session.userWorkspacePath, body.from),
        to: join(this.session.userWorkspacePath, body.to),
      },
    });
  }
  rename(body: fs.FsRenameData["body"]) {
    return fs.fsRename({
      client: this.client,
      body: {
        ...body,
        from: join(this.session.userWorkspacePath, body.from),
        to: join(this.session.userWorkspacePath, body.to),
      },
    });
  }
  remove(body: fs.FsRemoveData["body"]) {
    return fs.fsRemove({
      client: this.client,
      body: {
        ...body,
        path: join(this.session.userWorkspacePath, body.path),
      },
    });
  }
  mkdir(body: fs.FsMkdirData["body"]) {
    return fs.fsMkdir({
      client: this.client,
      body: {
        ...body,
        path: join(this.session.userWorkspacePath, body.path),
      },
    });
  }
}
