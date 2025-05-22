import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink"; // useStdout for terminal size
import { useQuery } from "@tanstack/react-query";
import { CodeSandbox } from "@codesandbox/sdk";

function formatAge(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

async function fetchSandboxes() {
  const sdk = new CodeSandbox();
  // Fetch first 10 sandboxes (can be paginated later)
  const { sandboxes } = await sdk.sandboxes.list({
    pagination: { page: 1, pageSize: 10 },
  });
  return sandboxes;
}

// Custom hook to get terminal size
function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState([stdout?.columns || 80, stdout?.rows || 24]);
  useEffect(() => {
    if (!stdout) return undefined;
    const handler = () => setSize([stdout.columns, stdout.rows]);
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);
  return size;
}

export function Dashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: fetchSandboxes,
  });

  useInput((input, key) => {});

  // Get terminal dimensions
  const [stdoutWidth, stdoutHeight] = useTerminalSize();

  if (isLoading) return <Text color="yellow">Loading sandboxes...</Text>;
  if (isError) return <Text color="red">Error: {String(error)}</Text>;
  if (!data || data.length === 0) return <Text>No sandboxes found.</Text>;

  // Define column widths
  const COLS = [
    { key: "id", label: "ID", width: 10 },
    { key: "title", label: "TITLE", width: 24 },
    { key: "privacy", label: "PRIVACY", width: 10 },
    { key: "tags", label: "TAGS", width: 20 },
    { key: "age", label: "AGE", width: 6 },
  ];

  // Helper to pad and trim cell content
  const pad = (str: string, width: number) => {
    if (str.length > width) return str.slice(0, width - 1) + "…";
    return str.padEnd(width, " ");
  };

  // Render header
  const header = COLS.map((col) => pad(col.label, col.width)).join(" ");

  // Render rows
  const rows = data.map((sandbox: any) => {
    const tags = Array.isArray(sandbox.tags) ? sandbox.tags.join(",") : "";
    const age = sandbox.updatedAt
      ? formatAge(new Date(sandbox.updatedAt))
      : "-";
    const cells = [
      pad(String(sandbox.id), COLS[0].width),
      pad(String(sandbox.title), COLS[1].width),
      pad(String(sandbox.privacy), COLS[2].width),
      pad(tags, COLS[3].width),
      pad(age, COLS[4].width),
    ];
    return cells.join(" ");
  });

  // Calculate how many rows fit (1 for header)
  const maxRows = Math.max(stdoutHeight - 1, 0);
  const visibleRows = rows.slice(0, maxRows);

  // Pad with empty rows if needed to fill the window
  while (visibleRows.length < maxRows) {
    visibleRows.push("");
  }

  return (
    <Box flexDirection="column">
      <Text bold>{header}</Text>
      {visibleRows.map((row, i) => (
        <Text key={i}>{row}</Text>
      ))}
    </Box>
  );
}
