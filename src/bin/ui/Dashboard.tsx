import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { useSDK } from "./sdkContext";
import { useQuery } from "@tanstack/react-query";
import { getSandbox, getRunningVms } from "./api";
import BigText from "ink-big-text";

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

// Component to open a sandbox by ID
export function Dashboard() {
  const { apiClient } = useSDK();
  
  // Poll getRunningVms API every 2 seconds
  const runningVmsQuery = useQuery({
    queryKey: ["runningVms"],
    queryFn: () => getRunningVms(apiClient),
  });

  const [sandboxId, setSandboxId] = useState("");
  const [showSandbox, setShowSandbox] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [stdoutWidth, stdoutHeight] = useTerminalSize();

  useEffect(() => {
    // have to manually do this because of environment
    const interval = setInterval(() => {
      runningVmsQuery.refetch();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useInput((input, key) => {
    if (!showSandbox) {
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
    const state = runningVmsQuery.isLoading
      ? "PENDING"
      : runningVmsQuery.data?.vms.find((vm) => vm.id === sandboxId)
      ? "RUNNING"
      : "IDLE";

    return (
      <Sandbox
        id={sandboxId}
        runningState={state}
        onBack={() => setShowSandbox(false)}
      />
    );
  }

  return (
    <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight} gap={1}>
      <Box flexDirection="column" marginTop={1}>
        <Text>█▀▀█    █▀▀ █▀█ █▀▄ █▀▀ █▀▀ ▄▀█ █▄ █ █▀▄ █▄▄ █▀█ ▀▄▀</Text>
        <Text>█▄▄█    █▄▄ █▄█ █▄▀ ██▄ ▄▄█ █▀█ █ ▀█ █▄▀ █▄█ █▄█ █ █</Text>
        {/* <BigText font="tiny" text="CodeSandbox" /> */}
      </Box>
      <Box>
        <Text>Enter Sandbox ID: </Text>
        <Text color={isFocused ? "green" : undefined}>{sandboxId || "_"}</Text>
      </Box>
      <Box>
        <Text dimColor>Type to input ID, press ENTER to open</Text>
      </Box>
    </Box>
  );
}

// Component to display a sandbox
const Sandbox = memo(
  ({
    id,
    runningState,
    onBack,
  }: {
    id: string;
    runningState: "RUNNING" | "IDLE" | "PENDING";
    onBack: () => void;
  }) => {
    const sandboxQuery = useQuery({
      queryKey: ["sandbox", id],
      queryFn: () => getSandbox(apiClient, id),
    });
    const runningStateRef = useRef(runningState);

    const { sdk, apiClient } = useSDK();

    // Only two states: RUNNING or IDLE
    const [sandboxState, setSandboxState] = useState<
      "RUNNING" | "IDLE" | "PENDING"
    >(runningState);
    const [selectedOption, setSelectedOption] = useState(0);
    const [stdoutWidth, stdoutHeight] = useTerminalSize();

    // We only want to update the state when the
    // running state has ACTUALLY changed (Reconciliation sucks)
    useEffect(() => {
      if (
        sandboxState !== "PENDING" &&
        runningStateRef.current !== runningState
      ) {
        runningStateRef.current = runningState;
        setSandboxState(runningState);
      }
    }, [runningState, sandboxState]);

    // Define menu options based on state
    const getMenuOptions = () => {
      switch (sandboxState) {
        case "RUNNING":
          return ["Hibernate", "Shutdown", "Restart"];
        case "IDLE":
          return ["Start"];
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
          setSandboxState("PENDING");
          await sdk.sandboxes.shutdown(id);
          setSandboxState("IDLE");
          setSelectedOption(0);
          break;
        case "Restart":
          setSandboxState("PENDING");
          await sdk.sandboxes.restart(id);
          setSandboxState("RUNNING");
          setSelectedOption(0);
          break;
        case "Start":
          setSandboxState("PENDING");
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
        {/* Handle query states */}
        {sandboxQuery.isLoading && (
          <Box marginY={1}>
            <Text color="blue">Loading sandbox information...</Text>
          </Box>
        )}

        {sandboxQuery.error && (
          <Box marginY={1}>
            <Text color="red">
              Error loading sandbox: {(sandboxQuery.error as Error).message}
            </Text>
          </Box>
        )}

        {sandboxQuery.data && (
          <Box flexDirection="column">
            <Text bold>
              {sandboxQuery.data.title} - {id}
            </Text>

            {sandboxQuery.data.description && (
              <Box marginTop={1}>
                <Text>{sandboxQuery.data.description}</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Status display - moved above title and description */}
        <Box marginY={1}>
          <Text>Status: </Text>
          <Text
            color={
              sandboxState === "RUNNING"
                ? "green"
                : sandboxState === "PENDING"
                ? "blue"
                : "yellow"
            }
          >
            {sandboxState}
          </Text>
        </Box>

        {menuOptions.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Actions:</Text>
            {menuOptions.map((option, index) => (
              <Box key={index}>
                <Text color={selectedOption === index ? "green" : undefined}>
                  {selectedOption === index ? "> " : "  "}
                  {option}
                </Text>
              </Box>
            ))}
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
);
