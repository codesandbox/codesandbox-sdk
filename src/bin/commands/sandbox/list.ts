import ora from "ora";
import Table from "cli-table3";
import { CodeSandbox } from "../../../";
import type {
  SandboxListOpts,
  SandboxInfo,
  PaginationOpts,
} from "../../../sandbox-client";

type OutputFormat = {
  field: string;
  header: string;
  width?: number;
};

const TABLE_FORMAT: OutputFormat[] = [
  { field: "id", header: "NAME", width: 24 },
  { field: "title", header: "TITLE", width: 40 },
  { field: "privacy", header: "PRIVACY", width: 10 },
  { field: "tags", header: "TAGS", width: 20 },
  { field: "updatedAt", header: "AGE" },
];

function formatAge(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

export async function listSandboxes(
  outputFields?: string,
  listOpts: SandboxListOpts & { pagination?: PaginationOpts } = {},
  showHeaders = true,
  limit?: number
) {
  const sdk = new CodeSandbox();
  const spinner = ora("Fetching sandboxes...").start();

  try {
    let allSandboxes: SandboxInfo[] = [];
    let totalCount = 0;
    let currentPage = 1;
    const pageSize = 50; // API's maximum page size

    while (true) {
      const {
        sandboxes,
        totalCount: total,
        pagination,
      } = await sdk.sandbox.list({
        ...listOpts,
        limit: undefined, // Force pagination so we can show progress
        pagination: {
          page: currentPage,
          pageSize,
        },
      });

      if (sandboxes.length === 0) {
        break;
      }

      totalCount = total;
      const newSandboxes = sandboxes.filter(
        (sandbox) =>
          !allSandboxes.some((existing) => existing.id === sandbox.id)
      );
      allSandboxes = [...allSandboxes, ...newSandboxes];

      spinner.text = `Fetching sandboxes... (${allSandboxes.length}${
        limit ? `/${Math.min(limit, totalCount)}` : `/${totalCount}`
      })`;

      // Stop if we've reached the total count
      if (allSandboxes.length >= totalCount) {
        break;
      }

      currentPage++;
    }

    // Apply limit after fetching all sandboxes
    if (limit) {
      allSandboxes = allSandboxes.slice(0, limit);
    }

    spinner.stop();

    if (outputFields) {
      // Custom output format - just print the requested fields
      const fields = outputFields.split(",").map((f) => f.trim());

      if (showHeaders) {
        // eslint-disable-next-line no-console
        console.log(fields.join("\t"));
      }

      allSandboxes.forEach((sandbox) => {
        const values = fields.map((field) => {
          const value = sandbox[field as keyof typeof sandbox];
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (Array.isArray(value)) {
            return value.join(",");
          }
          return value?.toString() || "";
        });
        // eslint-disable-next-line no-console
        console.log(values.join("\t"));
      });

      // eslint-disable-next-line no-console
      console.log(
        `\nShowing ${allSandboxes.length} of ${totalCount} sandboxes`
      );

      return;
    }

    // Table output format
    const table = new Table({
      head: showHeaders ? TABLE_FORMAT.map((f) => f.header) : [],
      colWidths: TABLE_FORMAT.map((f) => f.width ?? null),
      style: {
        head: ["bold"],
        border: [],
      },
      chars: {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        right: "",
        "right-mid": "",
        mid: "",
        "mid-mid": "",
        middle: " ",
      },
    });

    allSandboxes.forEach((sandbox) => {
      const row = TABLE_FORMAT.map((format) => {
        const value = sandbox[format.field as keyof typeof sandbox];
        if (format.field === "updatedAt" && value instanceof Date) {
          return formatAge(value);
        }
        if (Array.isArray(value)) {
          return value.join(",");
        }
        return value?.toString() || "";
      });
      table.push(row);
    });

    // eslint-disable-next-line no-console
    console.log(table.toString());

    if (limit && totalCount > allSandboxes.length) {
      // eslint-disable-next-line no-console
      console.log(
        `\nShowing ${allSandboxes.length} of ${totalCount} sandboxes`
      );
    }
  } catch (error) {
    spinner.fail("Failed to fetch sandboxes");
    throw error;
  }
}
