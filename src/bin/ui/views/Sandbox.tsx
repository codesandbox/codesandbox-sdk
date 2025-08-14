import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useView } from "../viewContext";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "../sdkContext";

export const Sandbox = () => {
  const { view, setView } = useView<"sandbox">();
  const { sdk, api } = useSDK();

  // Poll getRunningVms API every 2 seconds
  const runningVmsQuery = useQuery({
    queryKey: ["runningVms"],
    queryFn: () => api.listRunningVms(),
  });

  useEffect(() => {
    // have to manually do this because of environment
    const interval = setInterval(() => {
      runningVmsQuery.refetch();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const sandboxQuery = useQuery({
    queryKey: ["sandbox", view.params.id],
    queryFn: () => api.getSandbox(view.params.id),
    enabled: !!view.params.id,
  });

  const runningState = runningVmsQuery.isLoading
    ? "PENDING"
    : runningVmsQuery.data?.vms.find((vm) => vm.id === view.params.id)
    ? "RUNNING"
    : "IDLE";

  const runningStateRef = useRef(runningState);

  // Only two states: RUNNING or IDLE
  const [sandboxState, setSandboxState] = useState<
    "RUNNING" | "IDLE" | "PENDING"
  >(runningState);
  const [selectedOption, setSelectedOption] = useState(0);

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
        return ["Debug", "Hibernate", "Shutdown", "Restart"];
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
      case "Debug":
        setView({ name: "debug", params: { id: view.params.id } });
        break;
      case "Hibernate":
      case "Shutdown":
        setSandboxState("PENDING");
        await sdk.sandboxes.shutdown(view.params.id);
        setSandboxState("IDLE");
        setSelectedOption(0);
        break;
      case "Restart":
        setSandboxState("PENDING");
        await sdk.sandboxes.restart(view.params.id);
        setSandboxState("RUNNING");
        setSelectedOption(0);
        break;
      case "Start":
        setSandboxState("PENDING");
        await sdk.sandboxes.resume(view.params.id);
        setSandboxState("RUNNING");
        setSelectedOption(0);
        break;
    }
  };

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      setView({ name: "dashboard" });
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

  if (!view.params.id) {
    return <Box>No sandbox ID provided. Press escape to go back.</Box>;
  }

  return (
    <Box flexDirection="column">
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
            {sandboxQuery.data.title} - {view.params.id}
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
};
