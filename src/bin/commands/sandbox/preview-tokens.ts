import ora from "ora";
import Table from "cli-table3";
import { CodeSandbox } from "../../../";

function formatDate(date: Date): string {
  return date.toLocaleString();
}

export async function listPreviewTokens(sandboxId: string) {
  const sdk = new CodeSandbox();
  const spinner = ora("Fetching preview tokens...").start();

  try {
    const tokens = await sdk.sandbox.previewTokens.list(sandboxId);
    spinner.stop();

    if (tokens.length === 0) {
      console.log("No preview tokens found");
      return;
    }

    const table = new Table({
      head: ["ID", "PREFIX", "LAST USED", "EXPIRES"],
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

    tokens.forEach((token) => {
      table.push([
        token.tokenId,
        token.tokenPrefix,
        token.lastUsedAt ? formatDate(token.lastUsedAt) : "Never",
        token.expiresAt ? formatDate(token.expiresAt) : "Never",
      ]);
    });

    console.log(table.toString());
  } catch (error) {
    spinner.fail("Failed to fetch preview tokens");
    throw error;
  }
}

export async function createPreviewToken(
  sandboxId: string,
  expiresAt?: string
) {
  const sdk = new CodeSandbox();
  const spinner = ora("Creating preview token...").start();

  try {
    const token = await sdk.sandbox.previewTokens.create(
      sandboxId,
      expiresAt ? new Date(expiresAt) : null
    );
    spinner.stop();

    const table = new Table({
      head: ["TOKEN", "ID", "LAST USED", "EXPIRES"],
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

    table.push([
      token.token,
      token.tokenId,
      token.lastUsedAt ? formatDate(token.lastUsedAt) : "Never",
      token.expiresAt ? formatDate(token.expiresAt) : "Never",
    ]);

    console.log("Preview token created successfully:");
    console.log(table.toString());
  } catch (error) {
    spinner.fail("Failed to create preview token");
    throw error;
  }
}

export async function revokePreviewToken(
  sandboxId: string,
  previewTokenId: string
) {
  const sdk = new CodeSandbox();
  const spinner = ora("Revoking preview token...").start();

  try {
    await sdk.sandbox.previewTokens.revoke(sandboxId, previewTokenId);
    spinner.stop();
    console.log("Preview token revoked successfully");
  } catch (error) {
    spinner.fail("Failed to revoke preview token");
    throw error;
  }
}

export async function updatePreviewToken(
  sandboxId: string,
  previewTokenId: string,
  expiresAt?: string
) {
  const sdk = new CodeSandbox();
  const spinner = ora("Updating preview token...").start();

  try {
    await sdk.sandbox.previewTokens.update(
      sandboxId,
      previewTokenId,
      expiresAt ? new Date(expiresAt) : null
    );
    spinner.stop();
    console.log("Preview token updated successfully");
  } catch (error) {
    spinner.fail("Failed to update preview token");
    throw error;
  }
}

export async function revokeAllPreviewTokens(sandboxId: string) {
  const sdk = new CodeSandbox();
  const spinner = ora("Revoking all preview tokens...").start();

  try {
    await sdk.sandbox.previewTokens.revokeAll(sandboxId);
    spinner.stop();
    console.log("All preview tokens have been revoked");
  } catch (error) {
    spinner.fail("Failed to revoke preview tokens");
    throw error;
  }
}
