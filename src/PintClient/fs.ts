import { Client, createClient, createConfig } from "../api-clients/pint/client";
import {
  IAgentClientFS,
  PickRawFsResult,
} from "../agent-client-interface";
import {
  createFile,
  readFile,
  performFileAction,
  listDirectory,
  createDirectory,
  deleteDirectory,
  getFileStat,
} from "../api-clients/pint";
export class PintFsClient implements IAgentClientFS {
  constructor(private apiClient: Client) {}

  async readFile(path: string): Promise<PickRawFsResult<"fs/readFile">> {
    try {
      const response = await readFile({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // Convert string content to Uint8Array to match FSReadFileResult type
        const encoder = new TextEncoder();
        const content = encoder.encode(response.data.content);

        return {
          type: "ok",
          result: {
            content: content,
          },
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to read file",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async readdir(path: string): Promise<PickRawFsResult<"fs/readdir">> {
    try {
      const response = await listDirectory({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        const entries = response.data.files.map((fileInfo) => ({
          name: fileInfo.name,
          type: fileInfo.isDir ? (1 as const) : (0 as const), // 1 = directory, 0 = file
          isSymlink: false, // API doesn't provide symlink info, defaulting to false
        }));

        return {
          type: "ok",
          result: {
            entries: entries,
          },
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to read directory",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async writeFile(
    path: string,
    content: Uint8Array,
    create?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/writeFile">> {
     try {
      // Convert Uint8Array content to string for the API
      const decoder = new TextDecoder();
      const contentString = decoder.decode(content);

      const response = await createFile({
        client: this.apiClient,
        path: {
          path: path,
        },
        body: {
          content: contentString,
        },
      });

      if (response.data) {
        // FSWriteFileResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to write file",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

    async remove(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/remove">> {
    try {
      const response = await deleteDirectory({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // FSRemoveResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to remove directory",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async mkdir(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/mkdir">> {
    try {
      const response = await createDirectory({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // FSMkdirResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to create directory",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async stat(path: string): Promise<PickRawFsResult<"fs/stat">> {
    try {
      const response = await getFileStat({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // Parse modTime string to timestamp (assuming ISO string format)
        const modTimeMs = new Date(response.data.modTime).getTime();

        return {
          type: "ok",
          result: {
            type: response.data.isDir ? 1 : 0, // 1 = directory, 0 = file
            isSymlink: false, // API doesn't provide symlink info, defaulting to false
            size: response.data.size,
            mtime: modTimeMs,
            ctime: modTimeMs, // Using modTime as fallback since API doesn't provide ctime
            atime: modTimeMs, // Using modTime as fallback since API doesn't provide atime
          },
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to get file stat",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async copy(
    from: string,
    to: string,
    recursive?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/copy">> {
    try {
      const response = await performFileAction({
        client: this.apiClient,
        path: {
          path: from,
        },
        body: {
          action: 'copy',
          destination: to,
        },
      });

      if (response.data) {
        // FSCopyResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to copy file",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async rename(
    from: string,
    to: string,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/rename">> {
    try {
      const response = await performFileAction({
        client: this.apiClient,
        path: {
          path: from,
        },
        body: {
          action: 'move',
          destination: to,
        },
      });

      if (response.data) {
        // FSRenameResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to rename/move file",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async watch(
    path: string,
    options: {
      readonly recursive?: boolean;
      readonly excludes?: readonly string[];
    },
    onEvent: (watchEvent: any) => void
  ): Promise<
    | (PickRawFsResult<"fs/watch"> & { type: "error" })
    | { type: "success"; dispose(): void }
  > {
    throw new Error("Not implemented");
  }

  async download(path?: string): Promise<{ downloadUrl: string }> {
    throw new Error("Not implemented");
  }
}