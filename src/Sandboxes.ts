import type { Client } from "@hey-api/client-fetch";

import {
  sandboxFork,
  sandboxList,
  vmHibernate,
  vmShutdown,
  vmStart,
} from "./api-clients/client";
import { Sandbox } from "./Sandbox";
import {
  getDefaultTemplateTag,
  getStartOptions,
  getStartResponse,
  handleResponse,
} from "./utils/api";

import {
  CreateSandboxOpts,
  PaginationOpts,
  SandboxInfo,
  SandboxListOpts,
  SandboxListResponse,
  SandboxPrivacy,
  StartSandboxOpts,
} from "./types";
import { PitcherManagerResponse } from "@codesandbox/pitcher-client";
import { sleep } from "./utils/sleep";

export async function startVm(
  apiClient: Client,
  sandboxId: string,
  startOpts?: StartSandboxOpts
): Promise<PitcherManagerResponse> {
  const startResult = await vmStart({
    client: apiClient,
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
 * This class provides methods for creating and managing sandboxes.
 */
export class Sandboxes {
  get defaultTemplateId() {
    return getDefaultTemplateTag(this.apiClient);
  }

  constructor(private apiClient: Client) {}

  private async createTemplateSandbox(
    opts?: CreateSandboxOpts & StartSandboxOpts
  ) {
    const templateId = opts?.id || this.defaultTemplateId;
    const privacy = opts?.privacy || "unlisted";
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
        start_options: getStartOptions(opts),
      },
      path: {
        id: templateId,
      },
    });

    const sandbox = handleResponse(result, "Failed to create sandbox");

    return new Sandbox(
      sandbox.id,
      this.apiClient,
      getStartResponse(sandbox.start_response)
    );
  }

  /**
   * Resume a sandbox.
   *
   * - Hibernated with snapshot: It wakes up and continues within 2-3 seconds
   * - Hibernated with expired snapshot: It will start from scratch (CLEAN bootup)
   * - Shutdown: It will start from scratch (CLEAN bootup)
   *
   * Note! On CLEAN bootups the setup will run again. When hibernated a new snapshot will be created.
   */
  async resume(sandboxId: string) {
    const startResponse = await startVm(this.apiClient, sandboxId);
    return new Sandbox(sandboxId, this.apiClient, startResponse);
  }

  /**
   * Shuts down a sandbox. Files will be saved, and the sandbox will be stopped.
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
   * Forks a sandbox. This will create a new sandbox from the given sandbox.
   */
  public async fork(sandboxId: string, opts?: StartSandboxOpts) {
    return this.create({
      id: sandboxId,
      ...opts,
    });
  }

  /**
   * Restart the sandbox. This will shutdown the sandbox, and then start it again. Files in
   * the project directory (`/project/sandbox`) will be preserved.
   *
   * Will resolve once the sandbox is restarted with its setup running.
   */
  public async restart(sandboxId: string, opts?: StartSandboxOpts) {
    let didRestart = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.shutdown(sandboxId);
        didRestart = true;
      } catch (e) {
        await sleep(500);
      }
    }

    if (!didRestart) {
      throw new Error("Failed to shutdown VM after 3 attempts");
    }

    let startResponse: PitcherManagerResponse | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        startResponse = await startVm(this.apiClient, sandboxId, opts);
      } catch (e) {
        await sleep(500);
      }
    }

    if (!startResponse) {
      throw new Error("Failed to start VM after 3 attempts");
    }

    return new Sandbox(sandboxId, this.apiClient, startResponse);
  }

  /**
   * Hibernates a sandbox. Files will be saved, and the sandbox will be put to sleep. Next time
   * you resume the sandbox it will continue from the last state it was in.
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
   * Create a sandbox from a template. By default we will create a sandbox from the default universal template.
   */
  async create(opts?: CreateSandboxOpts & StartSandboxOpts): Promise<Sandbox> {
    return this.createTemplateSandbox(opts);
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
