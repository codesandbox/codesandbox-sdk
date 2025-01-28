import ora from "ora";
import Table from "cli-table3";
import { CodeSandbox } from "../../../";
import type { SandboxListOpts, SandboxInfo } from "../../../sandbox-client";

export const DEFAULT_LIMIT = 100;

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
  listOpts: SandboxListOpts = {},
  showHeaders = true,
  limit = DEFAULT_LIMIT
) {
  const sdk = new CodeSandbox();
  const spinner = ora("Fetching sandboxes...").start();

  try {
    let allSandboxes: SandboxInfo[] = [];
    let currentPage = listOpts.page || 1;
    const pageSize = listOpts.pageSize || 20;

    // Keep fetching until we hit the limit or run out of sandboxes
    while (true) {
      const { sandboxes, pagination } = await sdk.sandbox.list({
        ...listOpts,
        page: currentPage,
        pageSize,
      });

      allSandboxes = [...allSandboxes, ...sandboxes];

      // Stop if we've hit the limit
      if (allSandboxes.length >= limit) {
        allSandboxes = allSandboxes.slice(0, limit);
        break;
      }

      // Stop if there are no more pages
      if (!pagination.nextPage) {
        break;
      }

      currentPage = pagination.nextPage;
      spinner.text = `Fetching sandboxes... (${allSandboxes.length}/${limit})`;
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
  } catch (error) {
    spinner.fail("Failed to fetch sandboxes");
    throw error;
  }
}
