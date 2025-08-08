import { type IAgentClient } from "../AgentClient/agent-client-interface";

import { Disposable } from "../utils/disposable";
import { Emitter, type Event } from "../utils/event";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

export type FSStatResult = {
  type: "file" | "directory";
  isSymlink: boolean;
  size: number;
  mtime: number;
  ctime: number;
  atime: number;
};

export type WriteFileOpts = {
  create?: boolean;
  overwrite?: boolean;
};

export type ReaddirEntry = {
  name: string;
  type: "file" | "directory";
  isSymlink: boolean;
};

export type WatchOpts = {
  readonly recursive?: boolean;
  readonly excludes?: readonly string[];
};

export type WatchEvent = {
  paths: string[];
  type: "add" | "change" | "remove";
};

export type Watcher = {
  dispose(): void;
  onEvent: Event<WatchEvent>;
};

export class FileSystem {
  private disposable = new Disposable();
  private tracer?: Tracer;

  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient,
    private username?: string,
    tracer?: Tracer
  ) {
    this.tracer = tracer;
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  private async withSpan<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean> = {},
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return operation();
    }

    return this.tracer.startActiveSpan(
      operationName,
      { attributes },
      async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Write a file.
   */
  async writeFile(
    path: string,
    content: Uint8Array,
    opts: WriteFileOpts = {}
  ): Promise<void> {
    return this.withSpan(
      "fs.writeFile",
      {
        "fs.path": path,
        "fs.size": content.length,
        "fs.create": opts.create ?? true,
        "fs.overwrite": opts.overwrite ?? true
      },
      async () => {
        const result = await this.agentClient.fs.writeFile(
          path,
          content,
          opts.create ?? true,
          opts.overwrite ?? true
        );

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }
      }
    );
  }

  /**
   * Write a file as a string.
   */
  async writeTextFile(path: string, content: string, opts: WriteFileOpts = {}) {
    return this.withSpan(
      "fs.writeTextFile",
      {
        "fs.path": path,
        "fs.contentLength": content.length,
        "fs.create": opts.create ?? true,
        "fs.overwrite": opts.overwrite ?? true
      },
      async () => {
        return this.writeFile(path, new TextEncoder().encode(content), opts);
      }
    );
  }

  /**
   * Create a directory.
   */
  async mkdir(path: string, recursive = false): Promise<void> {
    return this.withSpan(
      "fs.mkdir",
      {
        "fs.path": path,
        "fs.recursive": recursive
      },
      async () => {
        const result = await this.agentClient.fs.mkdir(path, recursive);

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }
      }
    );
  }

  /**
   * Read a directory.
   */
  async readdir(path: string): Promise<ReaddirEntry[]> {
    return this.withSpan(
      "fs.readdir",
      { "fs.path": path },
      async () => {
        const result = await this.agentClient.fs.readdir(path);

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }

        return result.result.entries.map((entry) => ({
          ...entry,
          type: entry.type === 0 ? "file" : "directory",
        }));
      }
    );
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<Uint8Array> {
    return this.withSpan(
      "fs.readFile",
      { "fs.path": path },
      async () => {
        const result = await this.agentClient.fs.readFile(path);

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }

        return result.result.content;
      }
    );
  }

  /**
   * Read a file as a string.
   */
  async readTextFile(path: string): Promise<string> {
    return this.withSpan(
      "fs.readTextFile",
      { "fs.path": path },
      async () => {
        const content = await this.readFile(path);
        return new TextDecoder("utf-8").decode(content);
      }
    );
  }

  /**
   * Get the stat of a file or directory.
   */
  async stat(path: string): Promise<FSStatResult> {
    return this.withSpan(
      "fs.stat",
      { "fs.path": path },
      async () => {
        const result = await this.agentClient.fs.stat(path);

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }

        return {
          ...result.result,
          type:
            result.result.type === 0 ? ("file" as const) : ("directory" as const),
        };
      }
    );
  }

  /**
   * Copy a file or directory.
   */
  async copy(
    from: string,
    to: string,
    recursive = false,
    overwrite = false
  ): Promise<void> {
    return this.withSpan(
      "fs.copy",
      {
        "fs.from": from,
        "fs.to": to,
        "fs.recursive": recursive,
        "fs.overwrite": overwrite
      },
      async () => {
        const result = await this.agentClient.fs.copy(
          from,
          to,
          recursive,
          overwrite
        );

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }
      }
    );
  }

  /**
   * Rename a file or directory.
   */
  async rename(from: string, to: string, overwrite = false): Promise<void> {
    return this.withSpan(
      "fs.rename",
      {
        "fs.from": from,
        "fs.to": to,
        "fs.overwrite": overwrite
      },
      async () => {
        const result = await this.agentClient.fs.rename(from, to, overwrite);

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }
      }
    );
  }

  /**
   * Remove a file or directory.
   */
  async remove(path: string, recursive = false): Promise<void> {
    return this.withSpan(
      "fs.remove",
      {
        "fs.path": path,
        "fs.recursive": recursive
      },
      async () => {
        const result = await this.agentClient.fs.remove(path, recursive);

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }
      }
    );
  }

  /**
   * Watch for changes in the filesystem.
   *
   * ```ts
   * const watcher = await sandbox.fs.watch("/path/to/watch");
   * watcher.onEvent((event) => {
   *   console.log(event);
   * });
   *
   * // When done
   * watcher.dispose();
   * ```
   *
   * @param path - The path to watch.
   * @param options - The options for the watch.
   * @returns A watcher that can be disposed to stop the watch.
   */
  async watch(path: string, options: WatchOpts = {}): Promise<Watcher> {
    return this.withSpan(
      "fs.watch",
      {
        "fs.path": path,
        "fs.recursive": options.recursive ?? false,
        "fs.excludeCount": options.excludes?.length ?? 0
      },
      async () => {
        const emitter = new Emitter<WatchEvent>();

        const result = await this.agentClient.fs.watch(path, options, (event) => {
          if (this.username) {
            emitter.fire({
              ...event,
              paths: event.paths.map((path) =>
                path.replace(`home/${this.username}/workspace/`, "sandbox/")
              ),
            });
          } else {
            emitter.fire(event);
          }
        });

        if (result.type === "error") {
          throw new Error(`${result.errno}: ${result.error}`);
        }

        const watcher = {
          dispose: () => {
            result.dispose();
            emitter.dispose();
          },
          onEvent: emitter.event,
        };
        this.disposable.addDisposable(watcher);

        return watcher;
      }
    );
  }

  /**
   * Download a file or folder from the filesystem, can only be used to download
   * from within the workspace directory. A download URL that's valid for 5 minutes.
   */
  async download(path: string): Promise<{ downloadUrl: string }> {
    return this.withSpan(
      "fs.download",
      { "fs.path": path },
      async () => {
        const result = await this.agentClient.fs.download(path);

        return result;
      }
    );
  }
}
