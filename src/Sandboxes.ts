import { Sandbox } from "./Sandbox";
import { API } from "./API";
import { getDefaultTemplateTag, getStartOptions } from "./utils/api";

import {
  CreateSandboxOpts,
  PaginationOpts,
  SandboxInfo,
  SandboxListOpts,
  SandboxListResponse,
  SandboxPrivacy,
  StartSandboxOpts,
} from "./types";

/**
 * This class provides methods for creating and managing sandboxes.
 */
export class Sandboxes {
  get defaultTemplateId() {
    return getDefaultTemplateTag(this.api.getClient());
  }

  constructor(private api: API) {}

  private async createTemplateSandbox(
    opts?: CreateSandboxOpts & StartSandboxOpts
  ) {
    const templateId = opts?.id || this.defaultTemplateId;
    const privacy = opts?.privacy || "unlisted";
    const tags = opts?.tags || ["sdk"];
    let path = opts?.path || "/SDK";

    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Always add the "sdk" tag to the sandbox, this is used to identify sandboxes created by the SDK.
    const tagsWithSdk = tags.includes("sdk") ? tags : [...tags, "sdk"];
    const sandbox = await this.api.forkSandbox(templateId, {
      privacy: privacyToNumber(privacy),
      title: opts?.title,
      description: opts?.description,
      tags: tagsWithSdk,
      path,
    });

    const startResponse = await this.api.startVm(
      sandbox.id,
      getStartOptions(opts)
    );

    return new Sandbox(sandbox.id, this.api, startResponse);
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
    const startResponse = await this.api.startVm(sandboxId);
    return new Sandbox(sandboxId, this.api, startResponse);
  }

  /**
   * Shuts down a sandbox. Files will be saved, and the sandbox will be stopped.
   */
  async shutdown(sandboxId: string): Promise<void> {
    await this.api.shutdown(sandboxId);
  }

  /**
   * Forks a sandbox. This will create a new sandbox from the given sandbox.
   * @deprecated This will be removed shortly to avoid having multiple ways of doing the same thing
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
    try {
      await this.shutdown(sandboxId);
    } catch (e) {
      throw new Error("Failed to shutdown VM, " + String(e));
    }

    try {
      const startResponse = await this.api.startVm(sandboxId, opts);

      return new Sandbox(sandboxId, this.api, startResponse);
    } catch (e) {
      throw new Error("Failed to start VM, " + String(e));
    }
  }
  /**
   * Hibernates a sandbox. Files will be saved, and the sandbox will be put to sleep. Next time
   * you resume the sandbox it will continue from the last state it was in.
   */
  async hibernate(sandboxId: string): Promise<void> {
    await this.api.hibernate(sandboxId);
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
      const info = await this.api.listSandboxes({
        tags: opts.tags?.join(","),
        page: currentPage,
        page_size: pageSize,
        order_by: opts.orderBy,
        direction: opts.direction,
        status: opts.status,
      });
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
