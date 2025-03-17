import {
  WriteFileError,
  WriteFileRequest,
  WriteFileResponse,
} from "./client-rest";
import { SessionData } from "./sessions";
import { RestRequester } from "./rest-client";

export class FileSystemRest {
  constructor(
    private createRequester: (session: SessionData) => RestRequester
  ) {}
  writeTextFile(session: SessionData, path: string, content: string) {
    const request = this.createRequester(session);

    return request<WriteFileRequest, WriteFileResponse, WriteFileError>(
      "fs/writeFile",
      {
        path,

        // We are not able to generate the correct typing for OpenAPI here
        // @ts-expect-error
        content: new TextEncoder().encode(content),
        create: true,
        overwrite: true,
      }
    );
  }
}
