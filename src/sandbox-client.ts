import { initPitcherClient } from "@codesandbox/pitcher-client";
import type { Client } from "@hey-api/client-fetch";

import type { VmStartResponse, VmUpdateSpecsRequest } from "./client";
import {
  sandboxFork,
  vmCreateSession,
  sandboxList,
  vmHibernate,
  vmShutdown,
  vmStart,
  vmUpdateHibernationTimeout,
  vmUpdateSpecs,
  previewTokenCreate,
  previewTokenList,
  previewTokenRevokeAll,
  previewTokenUpdate,
} from "./client";
import { Sandbox, SandboxSession } from "./sandbox";
import { handleResponse } from "./utils/handle-response";
import { SessionCreateOptions, SessionConnectInfo } from "./sessions";

export type SandboxPrivacy = "public" | "unlisted" | "private";
export type SandboxStartData = Required<VmStartResponse>["data"];

export type SandboxInfo = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  description?: string;
  privacy: SandboxPrivacy;
  tags: string[];
};

export type SandboxListOpts = {
  tags?: string[];
  orderBy?: "inserted_at" | "updated_at";
  direction?: "asc" | "desc";
  status?: "running";
};

export interface SandboxListResponse {
  sandboxes: SandboxInfo[];
  hasMore: boolean;
  totalCount: number;
  pagination: {
    currentPage: number;
    nextPage: number | null;
    pageSize: number;
  };
}

export type PaginationOpts = {
  page?: number;
  pageSize?: number;
};

export const DEFAULT_SUBSCRIPTIONS = {
  client: {
    status: true,
  },
  file: {
    status: true,
    selection: true,
    ot: true,
  },
  fs: {
    operations: true,
  },
  git: {
    status: true,
    operations: true,
  },
  port: {
    status: true,
  },
  setup: {
    progress: true,
  },
  shell: {
    status: true,
  },
  system: {
    metrics: true,
  },
};

export type CreateSandboxOpts = {
  /**
   * What template to fork from, this is the id of another sandbox. Defaults to our
   * [universal template](https://codesandbox.io/s/github/codesandbox/sandbox-templates/tree/main/universal).
   */
  template?: string | Sandbox;

  /**
   * What the privacy of the new sandbox should be. Defaults to "public".
   */
  privacy?: SandboxPrivacy;

  /**
   * The title of the new sandbox.
   */
  title?: string;

  /**
   * The description of the new sandbox.
   */
  description?: string;

  /**
   * Whether to automatically connect to the sandbox after creation. If this is set to `false`,
   * the sandbox will not be connected to, and you will have to call {@link SandboxClient.start}
   * yourself or pass the returned start data to the browser.
   */
  autoConnect?: boolean;

  /**
   * Which tags to add to the sandbox, can be used for categorization and filtering. Max 10 tags.
   */
  tags?: string[];

  /**
   * In which folder to put the sandbox in (inside your workspace).
   */
  path?: string;
} & StartSandboxOpts;

/**
 * A VM tier is how we classify the specs of a VM. You can use this to request a VM with specific
 * specs.
 *
 * You can either get a tier by its name, or by specifying the minimum specs you need.
 *
 * ## Example
 *
 * ```ts
 * const tier = VMTier.Pico;
 * ```
 *
 * ```ts
 * const tier = VMTier.fromSpecs(16, 32, 40);
 * ```
 */
export class VMTier {
  /** 1 CPU, 2GiB RAM */
  public static readonly Pico = new VMTier("Pico", 1, 2, 20);
  /** 2 CPU, 4GiB RAM */
  public static readonly Nano = new VMTier("Nano", 2, 4, 20);
  /** 4 CPU, 8GiB RAM */
  public static readonly Micro = new VMTier("Micro", 4, 8, 20);
  /** 8 CPU, 16GiB RAM */
  public static readonly Small = new VMTier("Small", 8, 16, 30);
  /** 16 CPU, 32GiB RAM */
  public static readonly Medium = new VMTier("Medium", 16, 32, 40);
  /** 32 CPU, 64GiB RAM */
  public static readonly Large = new VMTier("Large", 32, 64, 50);
  /** 64 CPU, 128GiB RAM */
  public static readonly XLarge = new VMTier("XLarge", 64, 128, 50);

  public static readonly All = [
    VMTier.Pico,
    VMTier.Nano,
    VMTier.Micro,
    VMTier.Small,
    VMTier.Medium,
    VMTier.Large,
    VMTier.XLarge,
  ];

  private constructor(
    public readonly name: VmUpdateSpecsRequest["tier"],
    public readonly cpuCores: number,
    public readonly memoryGiB: number,
    public readonly diskGB: number
  ) {}

  public static fromName(name: VmUpdateSpecsRequest["tier"]): VMTier {
    return VMTier[name];
  }

  /**
   * Returns the tier that complies to the given minimum specs.
   * @param cpuCores Amount of CPU cores needed
   * @param memoryGiB Amount of memory needed in GiB
   * @param diskGB Amount of disk space needed in GB
   */
  public static fromSpecs(specs: {
    cpu: number;
    memGiB: number;
    diskGB?: number;
  }): VMTier | undefined {
    return Object.values(VMTier).find(
      (tier) =>
        tier.cpuCores >= specs.cpu &&
        tier.memoryGiB >= specs.memGiB &&
        (specs.diskGB === undefined || tier.diskGB >= specs.diskGB)
    );
  }
}

function startOptionsFromOpts(opts: StartSandboxOpts | undefined) {
  if (!opts) return undefined;
  return {
    ipcountry: opts.ipcountry,
    tier: opts.vmTier?.name,
    hibernation_timeout_seconds: opts.hibernationTimeoutSeconds,
  };
}

export interface StartSandboxOpts {
  /**
   * Country, served as a hint on where you want the sandbox to be scheduled. For example, if "NL" is given
   * as a country, the sandbox will be scheduled in a cluster inside Europe. Note that this is not a guarantee,
   * and the sandbox might end up in a different region based on availability and scheduling decisions.
   *
   * Follows ISO 3166-1 alpha-2 codes.
   */
  ipcountry?: string;

  /**
   * Determines which specs to start the VM with. If not specified, the VM will start with the default specs for the workspace.
   * Check {@link VMTier} for available tiers.
   *
   * You can only specify a VM tier when starting a VM that is inside your workspace.
   * Specifying a VM tier for someone else's sandbox will return an error.
   */
  vmTier?: VMTier;

  /**
   * The amount of seconds to wait before hibernating the sandbox after inactivity.
   *
   * Defaults to 300 seconds for free users, 1800 seconds for pro users. Maximum is 86400 seconds (1 day).
   */
  hibernationTimeoutSeconds?: number;
}

export type HandledResponse<D, E> = {
  data?: {
    data?: D;
  };
  error?: E;
  response: Response;
};

export class SandboxClient {
  constructor(private readonly apiClient: Client) {}

  private get defaultTemplate(): string {
    if (this.apiClient.getConfig().baseUrl?.includes("codesandbox.stream")) {
      return "7ngcrf";
    }

    return "pcz35m";
  }

  /**
   * Open, start & connect to a sandbox that already exists
   */
  public async open(
    id: string,
    startOpts?: StartSandboxOpts
  ): Promise<Sandbox> {
    return this.connectToSandbox(id, () => this.start(id, startOpts));
  }

  /**
   * Try to start a sandbox that already exists, it will return the data of the started
   * VM, which you can pass to the browser. In the browser you can call `connectToSandbox` with this
   * data to control the VM without sharing your CodeSandbox API token in the browser.
   *
   * @param id the ID of the sandbox
   * @returns The start data, contains a single use token to connect to the VM
   */
  public async start(
    id: string,
    opts?: StartSandboxOpts
  ): Promise<SandboxStartData> {
    const startResult = await vmStart({
      client: this.apiClient,
      body: startOptionsFromOpts(opts),
      path: {
        id,
      },
    });

    const data = handleResponse(startResult, `Failed to start sandbox ${id}`);

    return data;
  }

  /**
   * Creates a sandbox by forking a template. You can pass in any template or sandbox id (from
   * any sandbox/template created on codesandbox.io, even your own templates) or don't pass
   * in anything and we'll use the default universal template.
   *
   * This function will also start & connect to the VM of the created sandbox, and return a {@link Sandbox}
   * that allows you to control the VM.
   *
   * @param opts Additional options for creating the sandbox
   *
   * @returns A promise that resolves to a {@link Sandbox}, which you can use to control the VM
   */
  async create(
    opts: { autoConnect: false } & CreateSandboxOpts
  ): Promise<SandboxStartData>;
  async create(
    opts?: { autoConnect?: true } & CreateSandboxOpts
  ): Promise<Sandbox>;
  async create(opts?: CreateSandboxOpts): Promise<Sandbox>;
  async create(opts?: CreateSandboxOpts): Promise<Sandbox | SandboxStartData> {
    const templateId = opts?.template || this.defaultTemplate;
    const privacy = opts?.privacy || "public";
    const tags = opts?.tags || ["sdk"];
    const path = opts?.path || "/SDK";

    // Always add the "sdk" tag to the sandbox, this is used to identify sandboxes created by the SDK.
    const tagsWithSdk = tags.includes("sdk") ? tags : [...tags, "sdk"];

    const result = await sandboxFork({
      client: this.apiClient,
      body: {
        privacy: privacyToNumber(privacy),
        title: opts?.title,
        description: opts?.description,
        tags: tagsWithSdk,
        path,
        start_options:
          opts?.autoConnect === false
            ? undefined
            : startOptionsFromOpts(opts || {}),
      },
      path: {
        id: typeof templateId === "string" ? templateId : templateId.id,
      },
    });

    const sandbox = handleResponse(result, "Failed to create sandbox");

    return this.connectToSandbox(sandbox.id, () => {
      if (sandbox.start_response) {
        return Promise.resolve(sandbox.start_response);
      }

      return this.start(sandbox.id, opts);
    });
  }

  /**
   * This is the same functionality as {@link SandboxClient.create}, but added to make forking more
   * discoverable.
   */
  async fork(
    id: string,
    opts: { autoConnect: false } & Omit<CreateSandboxOpts, "template">
  ): Promise<SandboxStartData>;
  async fork(
    id: string,
    opts?: { autoConnect?: true } & Omit<CreateSandboxOpts, "template">
  ): Promise<Sandbox>;
  async fork(
    id: string,
    opts?: Omit<CreateSandboxOpts, "template">
  ): Promise<Sandbox>;
  async fork(
    id: string,
    opts: Omit<CreateSandboxOpts, "template"> = {}
  ): Promise<Sandbox | SandboxStartData> {
    return this.create({ ...opts, template: id });
  }

  /**
   * Shuts down a sandbox. Files will be saved, and the sandbox will be stopped.
   *
   * @param id The ID of the sandbox to shutdown
   */
  async shutdown(id: string): Promise<void> {
    const response = await vmShutdown({
      client: this.apiClient,
      path: {
        id,
      },
    });

    handleResponse(response, `Failed to shutdown sandbox ${id}`);
  }

  /**
   * Hibernates a sandbox. Files will be saved, and the sandbox will be put to sleep. Next time
   * you start the sandbox it will be resumed from the last state it was in.
   *
   * @param id The ID of the sandbox to hibernate
   */
  async hibernate(id: string): Promise<void> {
    const response = await vmHibernate({
      client: this.apiClient,
      path: {
        id,
      },
    });

    handleResponse(response, `Failed to hibernate sandbox ${id}`);
  }

  /**
   * List sandboxes from the current workspace with optional filters.
   *
   * This method supports two modes of operation:
   * 1. Simple limit-based fetching (default):
   *    ```ts
   *    // Get up to 50 sandboxes (default)
   *    const { sandboxes, totalCount } = await client.list();
   *
   *    // Get up to 200 sandboxes
   *    const { sandboxes, totalCount } = await client.list({ limit: 200 });
   *    ```
   *
   * 2. Manual pagination:
   *    ```ts
   *    // Get first page
   *    const { sandboxes, pagination } = await client.list({
   *      pagination: { page: 1, pageSize: 50 }
   *    });
   *    // pagination = { currentPage: 1, nextPage: 2, pageSize: 50 }
   *
   *    // Get next page if available
   *    if (pagination.nextPage) {
   *      const { sandboxes, pagination: nextPagination } = await client.list({
   *        pagination: { page: pagination.nextPage, pageSize: 50 }
   *      });
   *    }
   *    ```
   */
  async list(
    opts: SandboxListOpts & {
      limit?: number;
      pagination?: PaginationOpts;
    } = {}
  ): Promise<SandboxListResponse> {
    const limit = opts.limit ?? 50;
    let allSandboxes: SandboxInfo[] = [];
    let currentPage = opts.pagination?.page ?? 1;
    let pageSize = opts.pagination?.pageSize ?? limit;
    let totalCount = 0;
    let nextPage: number | null = null;

    while (true) {
      const response = await sandboxList({
        client: this.apiClient,
        query: {
          tags: opts.tags?.join(","),
          page: currentPage,
          page_size: pageSize,
          order_by: opts.orderBy,
          direction: opts.direction,
          status: opts.status,
        },
      });

      const info = handleResponse(response, "Failed to list sandboxes");
      totalCount = info.pagination.total_records;
      nextPage = info.pagination.next_page;

      const sandboxes = info.sandboxes.map((sandbox) => ({
        id: sandbox.id,
        createdAt: new Date(sandbox.created_at),
        updatedAt: new Date(sandbox.updated_at),
        title: sandbox.title ?? undefined,
        description: sandbox.description ?? undefined,
        privacy: privacyFromNumber(sandbox.privacy),
        tags: sandbox.tags,
      }));

      const newSandboxes = sandboxes.filter(
        (sandbox) =>
          !allSandboxes.some((existing) => existing.id === sandbox.id)
      );
      allSandboxes = [...allSandboxes, ...newSandboxes];

      // Stop if we've hit the limit or there are no more pages
      if (!nextPage || allSandboxes.length >= limit) {
        break;
      }

      currentPage = nextPage;
    }

    return {
      sandboxes: allSandboxes,
      hasMore: totalCount > allSandboxes.length,
      totalCount,
      pagination: {
        currentPage,
        nextPage: allSandboxes.length >= limit ? nextPage : null,
        pageSize,
      },
    };
  }

  /**
   * Updates the specs that this sandbox runs on. It will dynamically scale the sandbox to the
   * new specs without a reboot. Be careful when scaling specs down, if the VM is using more memory
   * than it can scale down to, it can become very slow.
   *
   * @param id The ID of the sandbox to update
   * @param tier The new VM tier
   */
  async updateTier(id: string, tier: VMTier): Promise<void> {
    const response = await vmUpdateSpecs({
      client: this.apiClient,
      path: { id },
      body: {
        tier: tier.name,
      },
    });

    handleResponse(response, `Failed to update sandbox tier ${id}`);
  }

  /**
   * Updates the hibernation timeout of a sandbox.
   *
   * @param id The ID of the sandbox to update
   * @param timeoutSeconds The new hibernation timeout in seconds
   */
  async updateHibernationTimeout(
    id: string,
    timeoutSeconds: number
  ): Promise<void> {
    const response = await vmUpdateHibernationTimeout({
      client: this.apiClient,
      path: { id },
      body: { hibernation_timeout_seconds: timeoutSeconds },
    });

    handleResponse(
      response,
      `Failed to update hibernation timeout for sandbox ${id}`
    );
  }

  private async connectToSandbox(
    id: string,
    startVm: () => Promise<
      Required<
        Required<
          Required<HandledResponse<VmStartResponse, unknown>>["data"]
        >["data"]
      >["data"]
    >
  ): Promise<Sandbox> {
    const pitcherClient = await initPitcherClient(
      {
        appId: "sdk",
        instanceId: id,
        onFocusChange() {
          return () => {};
        },
        requestPitcherInstance: async () => {
          const data = await startVm();
          const headers = this.apiClient.getConfig().headers as Headers;

          if (headers.get("x-pitcher-manager-url")) {
            // This is a hack, we need to tell the global scheduler that the VM is running
            // in a different cluster than the one it'd like to default to.

            const preferredManager = headers
              .get("x-pitcher-manager-url")
              ?.replace("/api/v1", "")
              .replace("https://", "");
            const baseUrl = this.apiClient
              .getConfig()
              .baseUrl?.replace("api", "global-scheduler");

            await fetch(
              `${baseUrl}/api/v1/cluster/${data.id}?preferredManager=${preferredManager}`
            ).then((res) => res.json());
          }

          return {
            bootupType: data.bootup_type as
              | "RUNNING"
              | "CLEAN"
              | "RESUME"
              | "FORK",
            pitcherURL: data.pitcher_url,
            workspacePath: data.workspace_path,
            userWorkspacePath: data.user_workspace_path,
            pitcherManagerVersion: data.pitcher_manager_version,
            pitcherVersion: data.pitcher_version,
            latestPitcherVersion: data.latest_pitcher_version,
            pitcherToken: data.pitcher_token,
            cluster: data.cluster,
          };
        },
        subscriptions: DEFAULT_SUBSCRIPTIONS,
      },
      () => {}
    );

    return new Sandbox(this, pitcherClient);
  }

  public async createSession(
    sandboxId: string,
    sessionId: string,
    options: SessionCreateOptions & { autoConnect: false }
  ): Promise<SessionConnectInfo>;
  public async createSession(
    sandboxId: string,
    sessionId: string,
    options?: SessionCreateOptions & { autoConnect?: true }
  ): Promise<SandboxSession>;
  public async createSession(
    sandboxId: string,
    sessionId: string,
    options?: SessionCreateOptions
  ): Promise<SandboxSession>;
  public async createSession(
    sandboxId: string,
    sessionId: string,
    options: SessionCreateOptions = {}
  ): Promise<SandboxSession | SessionConnectInfo> {
    const response = await vmCreateSession({
      client: this.apiClient,
      body: {
        session_id: sessionId,
        permission: options.permission ?? "write",
      },
      path: {
        id: sandboxId,
      },
    });

    const handledResponse = handleResponse(
      response,
      `Failed to create session ${sessionId}`
    );

    if (options.autoConnect === false) {
      return {
        id: sandboxId,
        pitcher_token: handledResponse.pitcher_token,
        pitcher_url: handledResponse.pitcher_url,
        user_workspace_path: handledResponse.user_workspace_path,
      };
    }

    const connectedSandbox = await this.connectToSandbox(sandboxId, () =>
      Promise.resolve({
        bootup_type: "RESUME",
        cluster: "session",
        id: sandboxId,
        latest_pitcher_version: "1.0.0-session",
        pitcher_manager_version: "1.0.0-session",
        pitcher_token: handledResponse.pitcher_token,
        pitcher_url: handledResponse.pitcher_url,
        pitcher_version: "1.0.0-session",
        reconnect_token: "",
        user_workspace_path: handledResponse.user_workspace_path,
        workspace_path: handledResponse.user_workspace_path,
      })
    );

    return connectedSandbox;
  }

  /**
   * Namespace for managing preview tokens that can be used to access private sandbox previews.
   */
  public readonly previewTokens = {
    /**
     * Generate a new preview token that can be used to access private sandbox previews.
     *
     * @param sandboxId - ID of the sandbox to create the token for
     * @param expiresAt - Optional expiration date for the preview token
     * @returns A preview token that can be used with Ports.getSignedPreviewUrl
     */
    create: async (sandboxId: string, expiresAt: Date | null = null) => {
      const response = handleResponse(
        await previewTokenCreate({
          client: this.apiClient,
          path: {
            id: sandboxId,
          },
          body: {
            expires_at: expiresAt?.toISOString(),
          },
        }),
        "Failed to create preview token"
      );

      if (!response.token?.token) {
        throw new Error("No token returned from API");
      }

      return {
        token: response.token.token,
        expiresAt: response.token.expires_at
          ? new Date(response.token.expires_at)
          : null,
        tokenId: response.token.token_id,
        tokenPrefix: response.token.token_prefix,
        lastUsedAt: response.token.last_used_at
          ? new Date(response.token.last_used_at)
          : null,
      };
    },

    /**
     * List all active preview tokens for a sandbox.
     *
     * @param sandboxId - ID of the sandbox to list tokens for
     * @returns A list of preview tokens
     */
    list: async (sandboxId: string) => {
      const response = handleResponse(
        await previewTokenList({
          client: this.apiClient,
          path: {
            id: sandboxId,
          },
        }),
        "Failed to list preview tokens"
      );

      if (!response.tokens) {
        return [];
      }

      return response.tokens.map((token) => ({
        expiresAt: token.expires_at ? new Date(token.expires_at) : null,
        tokenId: token.token_id,
        tokenPrefix: token.token_prefix,
        lastUsedAt: token.last_used_at ? new Date(token.last_used_at) : null,
      }));
    },

    /**
     * Revoke a single preview token for a sandbox.
     *
     * @param sandboxId - ID of the sandbox the token belongs to
     * @param tokenId - The ID of the token to revoke
     */
    revoke: async (sandboxId: string, tokenId: string): Promise<void> => {
      handleResponse(
        await previewTokenUpdate({
          client: this.apiClient,
          path: {
            id: sandboxId,
            token_id: tokenId,
          },
          body: {
            expires_at: new Date().toISOString(),
          },
        }),
        "Failed to revoke preview token"
      );
    },

    /**
     * Revoke all active preview tokens for a sandbox.
     * This will immediately invalidate all tokens, and they can no longer be used
     * to access the sandbox preview.
     *
     * @param sandboxId - ID of the sandbox to revoke tokens for
     */
    revokeAll: async (sandboxId: string): Promise<void> => {
      handleResponse(
        await previewTokenRevokeAll({
          client: this.apiClient,
          path: {
            id: sandboxId,
          },
        }),
        "Failed to revoke preview tokens"
      );
    },

    /**
     * Update a preview token's expiration date.
     *
     * @param sandboxId - ID of the sandbox the token belongs to
     * @param tokenId - The ID of the token to update
     * @param expiresAt - The new expiration date for the token (null for no expiration)
     * @returns The updated preview token info
     */
    update: async (
      sandboxId: string,
      tokenId: string,
      expiresAt: Date | null
    ) => {
      const response = handleResponse(
        await previewTokenUpdate({
          client: this.apiClient,
          path: {
            id: sandboxId,
            token_id: tokenId,
          },
          body: {
            expires_at: expiresAt?.toISOString(),
          },
        }),
        "Failed to update preview token"
      );

      if (!response.token) {
        throw new Error("No token returned from API");
      }

      return {
        expiresAt: response.token.expires_at
          ? new Date(response.token.expires_at)
          : null,
        tokenId: response.token.token_id,
        tokenPrefix: response.token.token_prefix,
        lastUsedAt: response.token.last_used_at
          ? new Date(response.token.last_used_at)
          : null,
      };
    },
  };
}

function privacyToNumber(privacy: SandboxPrivacy): number {
  switch (privacy) {
    case "public":
      return 0;
    case "unlisted":
      return 1;
    case "private":
      return 2;
  }
}

function privacyFromNumber(privacy: number): SandboxPrivacy {
  switch (privacy) {
    case 0:
      return "public";
    case 1:
      return "unlisted";
    case 2:
      return "private";
  }

  throw new Error(`Invalid privacy number: ${privacy}`);
}
