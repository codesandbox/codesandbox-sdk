import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useQuery } from "@tanstack/react-query";
import { CodeSandbox } from "@codesandbox/sdk";
import { useSDK } from "./sdkContext";

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

// Main menu component with navigation
export function Dashboard() {
  const [selectedOption, setSelectedOption] = useState(0);
  const [currentView, setCurrentView] = useState<string | null>(null);
  const [stdoutWidth, stdoutHeight] = useTerminalSize();

  const menuOptions = ["Open Sandbox", "List Sandboxes"];

  // Handle keyboard input for menu navigation
  useInput((input, key) => {
    // Navigation is only active when no view is selected
    if (currentView === null) {
      if (key.upArrow) {
        setSelectedOption((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (key.downArrow) {
        setSelectedOption((prev) =>
          prev < menuOptions.length - 1 ? prev + 1 : prev
        );
      } else if (key.return) {
        setCurrentView(menuOptions[selectedOption]);
      }
    } else if (key.escape) {
      // Allow going back to main menu with ESC key
      setCurrentView(null);
    }
  });

  // Render the current view or menu
  if (currentView === "List Sandboxes") {
    return <ListSandboxes onBack={() => setCurrentView(null)} />;
  } else if (currentView === "Open Sandbox") {
    return <OpenSandbox onBack={() => setCurrentView(null)} />;
  }

  // Render main menu
  return (
    <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight}>
      <Box marginBottom={1}>
        <Text bold>CodeSandbox Menu</Text>
      </Box>
      {menuOptions.map((option, index) => (
        <Box key={index} marginY={1}>
          <Text color={selectedOption === index ? "green" : undefined}>
            {selectedOption === index ? "> " : "  "}
            {option}
          </Text>
        </Box>
      ))}
      <Box marginTop={2}>
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
}

// Component to list sandboxes
function ListSandboxes({ onBack }: { onBack: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: fetchSandboxes,
  });

  // Get terminal dimensions
  const [stdoutWidth, stdoutHeight] = useTerminalSize();

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });

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
  const maxRows = Math.max(stdoutHeight - 3, 0); // Leave space for instructions
  const visibleRows = rows.slice(0, maxRows);

  // Pad with empty rows if needed to fill the window
  while (visibleRows.length < maxRows) {
    visibleRows.push("");
  }

  return (
    <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight}>
      <Box marginBottom={1}>
        <Text bold>Sandboxes List</Text>
      </Box>
      <Text bold>{header}</Text>
      {visibleRows.map((row, i) => (
        <Text key={i}>{row}</Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Press ESC to return to menu</Text>
      </Box>
    </Box>
  );
}

// Component to open a sandbox by ID
function OpenSandbox({ onBack }: { onBack: () => void }) {
  const [sandboxId, setSandboxId] = useState("");
  const [showSandbox, setShowSandbox] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [stdoutWidth, stdoutHeight] = useTerminalSize();

  useInput((input, key) => {
    if (key.escape && !showSandbox) {
      onBack();
    } else if (isFocused && !showSandbox) {
      if (key.return) {
        if (sandboxId.trim()) {
          setShowSandbox(true);
        }
      } else if (key.backspace || key.delete) {
        setSandboxId((prev) => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && !key.shift) {
        // Only add printable characters
        setSandboxId((prev) => prev + input);
      }
    }
  });

  if (showSandbox) {
    return <Sandbox id={sandboxId} onBack={() => setShowSandbox(false)} />;
  }

  return (
    <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight}>
      <Box marginBottom={1}>
        <Text bold>Open Sandbox</Text>
      </Box>
      <Box marginY={1}>
        <Text>Enter Sandbox ID: </Text>
        <Text color={isFocused ? "green" : undefined}>{sandboxId || "_"}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Type to input ID, press ENTER to open, ESC to return to menu
        </Text>
      </Box>
    </Box>
  );
}

// Component to display a sandbox
function Sandbox({ id, onBack }: { id: string; onBack: () => void }) {
  const sdk = useSDK();

  // Only two states: RUNNING or IDLE
  const [sandboxState, setSandboxState] = useState<
    "RUNNING" | "IDLE" | "STARTING"
  >("IDLE");
  const [selectedOption, setSelectedOption] = useState(0);
  const [stdoutWidth, stdoutHeight] = useTerminalSize();

  // Define menu options based on state
  const getMenuOptions = () => {
    switch (sandboxState) {
      case "RUNNING":
        return ["Hibernate", "Shutdown", "Restart"];
      case "IDLE":
        return ["Start"];
      case "STARTING":
        return [];
      default:
        return [];
    }
  };

  const menuOptions = getMenuOptions();

  // Handle menu options
  const handleAction = async (action: string) => {
    switch (action) {
      case "Hibernate":
      case "Shutdown":
        setSandboxState("IDLE");
        setSelectedOption(0);
        break;
      case "Restart":
        setSandboxState("STARTING");
        setTimeout(() => {
          setSandboxState("RUNNING");
          setSelectedOption(0);
        }, 2000);
        break;
      case "Start":
        setSandboxState("STARTING");
        await sdk.sandboxes.resume(id);
        setSandboxState("RUNNING");
        setSelectedOption(0);
        break;
    }
  };

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    } else if (menuOptions.length > 0) {
      if (key.upArrow) {
        setSelectedOption((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (key.downArrow) {
        setSelectedOption((prev) =>
          prev < menuOptions.length - 1 ? prev + 1 : prev
        );
      } else if (key.return) {
        handleAction(menuOptions[selectedOption]);
      }
    }
  });

  return (
    <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight}>
      <Box marginBottom={1}>
        <Text bold>Sandbox: {id}</Text>
      </Box>
      <Box marginY={1}>
        <Text>Status: </Text>
        <Text
          color={
            sandboxState === "RUNNING"
              ? "green"
              : sandboxState === "STARTING"
              ? "blue"
              : "yellow"
          }
        >
          {sandboxState}
        </Text>
      </Box>

      {menuOptions.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text bold>Actions:</Text>
          {menuOptions.map((option, index) => (
            <Box key={index} marginY={1}>
              <Text color={selectedOption === index ? "green" : undefined}>
                {selectedOption === index ? "> " : "  "}
                {option}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {sandboxState === "STARTING" && (
        <Box marginY={1}>
          <Text color="blue">Sandbox is starting...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {menuOptions.length > 0
            ? "Use arrow keys to navigate, Enter to select, ESC to go back"
            : "Press ESC to go back"}
        </Text>
      </Box>
    </Box>
  );
}
