import { type IPitcherClient } from "@codesandbox/pitcher-client";

import { Disposable } from "../../utils/disposable";
import { Emitter, type Event } from "../../utils/event";

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
  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient,
    private sessionId?: string
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  /**
   * Write a file.
   */
  async writeFile(
    path: string,
    content: Uint8Array,
    opts: WriteFileOpts = {}
  ): Promise<void> {
    const result = await this.pitcherClient.clients.fs.writeFile(
      path,
      content,
      opts.create ?? true,
      opts.overwrite ?? true
    );

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }
  }

  /**
   * Write a file as a string.
   */
  async writeTextFile(path: string, content: string, opts: WriteFileOpts = {}) {
    return this.writeFile(path, new TextEncoder().encode(content), opts);
  }

  /**
   * Create a directory.
   */
  async mkdir(path: string, recursive = false): Promise<void> {
    const result = await this.pitcherClient.clients.fs.mkdir(path, recursive);

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }
  }

  /**
   * Read a directory.
   */
  async readdir(path: string): Promise<ReaddirEntry[]> {
    const result = await this.pitcherClient.clients.fs.readdir(path);

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }

    return result.result.entries.map((entry) => ({
      ...entry,
      type: entry.type === 0 ? "file" : "directory",
    }));
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<Uint8Array> {
    const result = await this.pitcherClient.clients.fs.readFile(path);

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }

    return result.result.content;
  }

  /**
   * Read a file as a string.
   */
  async readTextFile(path: string): Promise<string> {
    return await this.readFile(path).then((content) =>
      new TextDecoder("utf-8").decode(content)
    );
  }

  /**
   * Get the stat of a file or directory.
   */
  async stat(path: string): Promise<FSStatResult> {
    const result = await this.pitcherClient.clients.fs.stat(path);

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }

    return {
      ...result.result,
      type:
        result.result.type === 0 ? ("file" as const) : ("directory" as const),
    };
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
    const result = await this.pitcherClient.clients.fs.copy(
      from,
      to,
      recursive,
      overwrite
    );

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }
  }

  /**
   * Rename a file or directory.
   */
  async rename(from: string, to: string, overwrite = false): Promise<void> {
    const result = await this.pitcherClient.clients.fs.rename(
      from,
      to,
      overwrite
    );

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }
  }

  /**
   * Remove a file or directory.
   */
  async remove(path: string, recursive = false): Promise<void> {
    const result = await this.pitcherClient.clients.fs.remove(path, recursive);

    if (result.type === "error") {
      throw new Error(`${result.errno}: ${result.error}`);
    }
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
    const emitter = new Emitter<WatchEvent>();

    const result = await this.pitcherClient.clients.fs.watch(
      path,
      options,
      (event) => {
        if (this.sessionId) {
          emitter.fire({
            ...event,
            paths: event.paths.map((path) =>
              path.replace(
                `home/csb-session-${this.sessionId}/workspace/`,
                "sandbox/"
              )
            ),
          });
        } else {
          emitter.fire(event);
        }
      }
    );

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

  /**
   * Download a file or folder from the filesystem, can only be used to download
   * from within the workspace directory. A download URL that's valid for 5 minutes.
   */
  async download(path: string): Promise<{ downloadUrl: string }> {
    const result = await this.pitcherClient.clients.fs.download(path);

    return result;
  }
}
