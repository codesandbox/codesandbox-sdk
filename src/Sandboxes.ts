import { Sandbox } from "./Sandbox";
import { API } from "./API";
import { getDefaultTemplateTag, getStartOptions } from "./utils/api";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

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
  private tracer?: Tracer;

  get defaultTemplateId() {
    return getDefaultTemplateTag(this.api.getClient());
  }

  constructor(private api: API, tracer?: Tracer) {
    this.tracer = tracer;
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
   * Resume a sandbox.
   *
   * - Hibernated with snapshot: It wakes up and continues within 2-3 seconds
   * - Hibernated with expired snapshot: It will start from scratch (CLEAN bootup)
   * - Shutdown: It will start from scratch (CLEAN bootup)
   *
   * Note! On CLEAN bootups the setup will run again. When hibernated a new snapshot will be created.
   */
  async resume(sandboxId: string) {
    return this.withSpan(
      "sandboxes.resume",
      { "sandbox.id": sandboxId },
      async () => {
        const startResponse = await this.api.startVm(sandboxId, {
          retryDelay: 500,
        }); // Use 500ms delay for resume
        return new Sandbox(sandboxId, this.api, startResponse, this.tracer);
      }
    );
  }

  /**
   * Shuts down a sandbox. Files will be saved, and the sandbox will be stopped.
   */
  async shutdown(sandboxId: string): Promise<void> {
    return this.withSpan(
      "sandboxes.shutdown",
      { "sandbox.id": sandboxId },
      async () => {
        await this.api.shutdown(sandboxId);
      }
    );
  }

  /**
   * Forks a sandbox. This will create a new sandbox from the given sandbox.
   * @deprecated This will be removed shortly to avoid having multiple ways of doing the same thing
   */
  public async fork(sandboxId: string, opts?: StartSandboxOpts) {
    return this.withSpan(
      "sandboxes.fork",
      { "sandbox.id": sandboxId },
      async () => {
        return this.create({
          id: sandboxId,
          ...opts,
        });
      }
    );
  }

  /**
   * Restart the sandbox. This will shutdown the sandbox, and then start it again. Files in
   * the project directory (`/project/sandbox`) will be preserved.
   *
   * Will resolve once the sandbox is restarted with its setup running.
   */
  public async restart(sandboxId: string, opts?: StartSandboxOpts) {
    return this.withSpan(
      "sandboxes.restart",
      { "sandbox.id": sandboxId },
      async () => {
        try {
          await this.shutdown(sandboxId);
        } catch (e) {
          throw new Error("Failed to shutdown VM, " + String(e));
        }

        try {
          const startResponse = await this.api.startVm(sandboxId, {
            ...opts,
            retryDelay: 1000,
          }); // Use 1000ms delay for restart

          return new Sandbox(sandboxId, this.api, startResponse, this.tracer);
        } catch (e) {
          throw new Error("Failed to start VM, " + String(e));
        }
      }
    );
  }
  /**
   * Hibernates a sandbox. Files will be saved, and the sandbox will be put to sleep. Next time
   * you resume the sandbox it will continue from the last state it was in.
   */
  async hibernate(sandboxId: string): Promise<void> {
    return this.withSpan(
      "sandboxes.hibernate",
      { "sandbox.id": sandboxId },
      async () => {
        await this.api.hibernate(sandboxId);
      }
    );
  }

  private isTemplateId(id: string) {
    return (
      id === this.defaultTemplateId ||
      // We allow template tags
      id.startsWith("pt_") ||
      // We allow template aliases
      id.match(/^[^@]+@[^@]+$/)
    );
  }

  /**
   * Create a sandbox from a template. By default we will create a sandbox from the default universal template.
   */
  async create(opts?: CreateSandboxOpts & StartSandboxOpts): Promise<Sandbox> {
    return this.withSpan(
      "sandboxes.create",
      {
        "template.id": opts?.id || this.defaultTemplateId,
        "sandbox.privacy": opts?.privacy || "public-hosts",
      },
      async () => {
        const templateId = opts?.id || this.defaultTemplateId;

        if (!this.isTemplateId(templateId)) {
          console.warn(
            `You are creating a sandbox from an existing sandbox. This can cause a degraded experience if the sandbox is running or has been archived. Please ensure you follow best practices documentation for creating sandboxes.`
          );
        }

        const privacy = opts?.privacy || "public-hosts";
        const tags = opts?.tags || ["sdk"];
        let path = opts?.path || "/SDK";

        if (!path.startsWith("/")) {
          path = "/" + path;
        }

        // Always add the "sdk" tag to the sandbox, this is used to identify sandboxes created by the SDK.
        const tagsWithSdk = tags.includes("sdk") ? tags : [...tags, "sdk"];

        const { mappedPrivacy, privatePreview } = mapPrivacyForApi(privacy);

        const sandbox = await this.api.forkSandbox(templateId, {
          privacy: mappedPrivacy,
          title: opts?.title,
          description: opts?.description,
          tags: tagsWithSdk,
          path,
          private_preview: privatePreview,
        });

        const startResponse = await this.api.startVm(
          sandbox.id,
          { ...getStartOptions(opts), retryDelay: 200 } // Keep 200ms delay for creation
        );

        return new Sandbox(sandbox.id, this.api, startResponse, this.tracer);
      }
    );
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
    return this.withSpan(
      "sandboxes.list",
      {
        "list.limit": opts.limit ?? 50,
        "list.tags": opts.tags?.join(",") || "",
        "list.orderBy": opts.orderBy || "inserted_at",
        "list.direction": opts.direction || "desc",
      },
      async () => {
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
    );
  }

  /**
   * List information about currently running VMs.
   *
   * This information is updated roughly every 30 seconds, so this data is not
   * guaranteed to be perfectly up-to-date.
   */
  async listRunning() {
    return this.withSpan("sandboxes.listRunning", {}, async () => {
      const data = await this.api.listRunningVms();

      return {
        concurrentVmCount: data.concurrent_vm_count,
        concurrentVmLimit: data.concurrent_vm_limit,
        vms: data.vms.map((vm) => ({
          id: vm.id,
          creditBasis: vm.credit_basis,
          lastActiveAt: vm.last_active_at
            ? parseTimestamp(vm.last_active_at)
            : undefined,
          sessionStartedAt: vm.session_started_at
            ? parseTimestamp(vm.session_started_at)
            : undefined,
          specs: vm.specs
            ? {
                cpu: vm.specs.cpu,
                memory: vm.specs.memory,
                storage: vm.specs.storage,
              }
            : undefined,
        })),
      };
    });
  }

  /**
   * Get a single sandbox by ID efficiently without listing all sandboxes.
   *
   * This method directly retrieves metadata for a specific sandbox ID,
   * avoiding the performance overhead of the list-and-filter pattern.
   *
   * @param sandboxId The ID of the sandbox to retrieve
   * @returns Promise<SandboxInfo> The sandbox metadata
   * @throws Error if the sandbox is not found or access is denied
   *
   * @example
   * ```ts
   * const sandbox = await client.sandboxes.get("sandbox-id");
   * console.log(sandbox.title, sandbox.tags);
   * ```
   */
  async get(sandboxId: string): Promise<SandboxInfo> {
    const sandbox = await this.api.getSandbox(sandboxId);

    return {
      id: sandbox.id,
      createdAt: new Date(sandbox.created_at),
      updatedAt: new Date(sandbox.updated_at),
      title: sandbox.title ?? undefined,
      description: sandbox.description ?? undefined,
      privacy: privacyFromNumber(sandbox.privacy),
      tags: sandbox.tags,
    };
  }
}

function parseTimestamp(timestamp: number | string): Date | undefined {
  if (!timestamp || timestamp === 0) {
    return undefined;
  }

  // Convert string to number if needed
  const numTimestamp =
    typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;

  // Handle both seconds and milliseconds timestamps
  const ts = numTimestamp < 10000000000 ? numTimestamp * 1000 : numTimestamp;
  const date = new Date(ts);

  // Return undefined if the date is invalid
  return isNaN(date.getTime()) ? undefined : date;
}

function mapPrivacyForApi(privacy: SandboxPrivacy): {
  mappedPrivacy: number;
  privatePreview?: boolean;
} {
  switch (privacy) {
    case "unlisted":
      return { mappedPrivacy: 1 }; // Keep as unlisted
    case "private":
      return { mappedPrivacy: 2, privatePreview: true }; // Keep as private
    case "public":
      return { mappedPrivacy: 1 }; // Map to unlisted
    case "public-hosts":
      return { mappedPrivacy: 2, privatePreview: false }; // Map to private with public preview
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
