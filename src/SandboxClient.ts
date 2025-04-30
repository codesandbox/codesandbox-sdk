import type { Client } from "@hey-api/client-fetch";
import { createClient, createConfig } from "@hey-api/client-fetch";

import {
  sandboxFork,
  sandboxList,
  vmHibernate,
  vmShutdown,
  vmStart,
} from "./api-clients/client";
import { VMTier } from "./VMTier";
import { Sandbox } from "./Sandbox";
import {
  getBaseUrl,
  getStartOptions,
  getStartResponse,
  handleResponse,
} from "./utils/api";
import { ClientOpts } from ".";
import {
  CreateSandboxGitSourceOpts,
  CreateSandboxOpts,
  CreateSandboxTemplateSourceOpts,
  PaginationOpts,
  SandboxInfo,
  SandboxListOpts,
  SandboxListResponse,
  SandboxPrivacy,
  StartSandboxOpts,
} from "./types";
import { PitcherManagerResponse } from "@codesandbox/pitcher-client";
import { PreviewTokens } from "./PreviewTokens";

export class SandboxClient {
  private apiClient: Client;

  get defaultTemplateId() {
    if (this.apiClient.getConfig().baseUrl?.includes("codesandbox.stream")) {
      return "7ngcrf";
    }

    return "pcz35m";
  }

  /**
   * Provider for generating preview tokens. These tokens can be used to generate signed
   * preview URLs for private sandboxes.
   *
   * @example
   * ```ts
   * const sandbox = await sdk.sandbox.create();
   * const previewToken = await sandbox.previewTokens.createToken();
   * const url = sandbox.ports.getSignedPreviewUrl(8080, previewToken.token);
   * ```
   */
  public readonly previewTokens: PreviewTokens;

  constructor(apiToken: string, opts: ClientOpts) {
    const baseUrl =
      process.env.CSB_BASE_URL ?? opts.baseUrl ?? getBaseUrl(apiToken);

    this.apiClient = this.apiClient = createClient(
      createConfig({
        baseUrl,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          ...(opts.headers ?? {}),
        },
        fetch: opts.fetch ?? fetch,
      })
    );
    this.previewTokens = new PreviewTokens(this.apiClient);
  }

  private async createGitSandbox(
    opts: CreateSandboxGitSourceOpts & StartSandboxOpts
  ) {
    const sandbox = await this.createTemplateSandbox({
      ...opts,
      source: "template",
      id: this.defaultTemplateId,
    });

    const client = await sandbox.connect(
      // We do not want users to pass gitAccessToken on global user, because it
      // can be read by other users
      opts.gitAccessToken
        ? {
            id: "clone-admin",
            permission: "write",
          }
        : undefined
    );

    await client.shells.run(
      [
        "rm -rf .git",
        "git init",
        `git remote add origin ${opts.url}`,
        "git fetch origin",
        `git checkout -b ${opts.branch}`,
        `git reset --hard origin/${opts.branch}`,
      ].join("&&")
    );

    client.disconnect();

    return sandbox;
  }

  private async createTemplateSandbox(
    opts: CreateSandboxTemplateSourceOpts & StartSandboxOpts
  ) {
    const templateId = opts.id || this.defaultTemplateId;
    const privacy = opts.privacy || "public";
    const tags = opts.tags || ["sdk"];
    const path = opts.path || "/SDK";

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
        start_options: getStartOptions(opts),
      },
      path: {
        id: templateId,
      },
    });

    const sandbox = handleResponse(result, "Failed to create sandbox");

    return new Sandbox(
      sandbox.id,
      getStartResponse(sandbox.start_response),
      this.apiClient
    );
  }

  private async start(
    sandboxId: string,
    startOpts?: StartSandboxOpts
  ): Promise<PitcherManagerResponse> {
    const startResult = await vmStart({
      client: this.apiClient,
      body: startOpts
        ? {
            ipcountry: startOpts.ipcountry,
            tier: startOpts.vmTier?.name,
            hibernation_timeout_seconds: startOpts.hibernationTimeoutSeconds,
            automatic_wakeup_config: startOpts.automaticWakeupConfig,
          }
        : undefined,
      path: {
        id: sandboxId,
      },
    });

    const response = handleResponse(
      startResult,
      `Failed to start sandbox ${sandboxId}`
    );

    return getStartResponse(response);
  }

  /**
   *
   */
  async resume(sandboxId: string) {
    const startResponse = await this.start(sandboxId);
    return new Sandbox(sandboxId, startResponse, this.apiClient);
  }

  /**
   * Shuts down a sandbox. Files will be saved, and the sandbox will be stopped.
   *
   * @param sandboxId The ID of the sandbox to shutdown
   */
  async shutdown(sandboxId: string): Promise<void> {
    const response = await vmShutdown({
      client: this.apiClient,
      path: {
        id: sandboxId,
      },
    });

    handleResponse(response, `Failed to shutdown sandbox ${sandboxId}`);
  }

  /**
   * Restart the sandbox. This will shutdown the sandbox, and then start it again. Files in
   * the project directory (`/project/sandbox`) will be preserved.
   *
   * Will resolve once the sandbox is rebooted.
   */
  public async restart(sandboxId: string, opts?: StartSandboxOpts) {
    await this.shutdown(sandboxId);
    const startResponse = await this.start(sandboxId, opts);

    return new Sandbox(sandboxId, startResponse, this.apiClient);
  }

  /**
   * Hibernates a sandbox. Files will be saved, and the sandbox will be put to sleep. Next time
   * you start the sandbox it will be resumed from the last state it was in.
   *
   * @param sandboxId The ID of the sandbox to hibernate
   */
  async hibernate(sandboxId: string): Promise<void> {
    const response = await vmHibernate({
      client: this.apiClient,
      path: {
        id: sandboxId,
      },
    });

    handleResponse(response, `Failed to hibernate sandbox ${sandboxId}`);
  }

  /**
   * Creates a sandbox by forking a template. You can pass in any template or sandbox id (from
   * any sandbox/template created on codesandbox.io, even your own templates) or don't pass
   * in anything and we'll use the default universal template.
   *
   * This function will also start & connect to the VM of the created sandbox with a global session, and return a {@link Sandbox}
   * that allows you to control the VM. Pass "autoConnect: false" to only return the session data.
   *
   * @param opts Additional options for creating the sandbox
   *
   * @returns A promise that resolves to a {@link Sandbox}, which you can use to control the VM
   */
  async create(
    opts: CreateSandboxOpts & StartSandboxOpts = { source: "template" }
  ): Promise<Sandbox> {
    switch (opts.source) {
      case "git": {
        return this.createGitSandbox(opts);
      }
      case "files": {
        throw new Error("Not implemented");
      }
      case "template": {
        return this.createTemplateSandbox(opts);
      }
    }
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
