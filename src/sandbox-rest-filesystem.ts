import * as fs from "./client-rest-fs";
import { SessionData } from "./sessions";

export type FileSystemRestRequester = <
  P extends {},
  S extends fs.SuccessResponse,
  E extends fs.ErrorResponse
>(
  method: string,
  params: P
) => Promise<S | E>;

export class SandboxRestFileSystem {
  constructor(
    private createRequester: (session: SessionData) => FileSystemRestRequester
  ) {}
  writeTextFile(session: SessionData, path: string, content: string) {
    const request = this.createRequester(session);

    return request<
      fs.WriteFileRequest,
      fs.WriteFileResponse,
      fs.WriteFileError
    >("fs/writeFile", {
      path,

      // We are not able to generate the correct typing for OpenAPI here
      // @ts-expect-error
      content: new TextEncoder().encode(content),
      create: true,
      overwrite: true,
    });
  }
}
