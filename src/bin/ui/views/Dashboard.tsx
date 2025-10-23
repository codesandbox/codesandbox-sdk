import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useView } from "../viewContext";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "../sdkContext";
import { TextInput } from "../components/TextInput";
import { VmTable } from "../components/VmTable";
import { useVmInput } from "../hooks/useVmInput";
import { useTerminalSize } from "../hooks/useTerminalSize";

const calculateRuntimeMs = (
  startedAt: string | undefined,
  lastActiveAt: string | undefined
): number => {
  if (!startedAt || !lastActiveAt) {
    return 0;
  }

  try {
    const startDate = new Date(startedAt);
    const lastActiveDate = new Date(lastActiveAt);

    const diffMs = lastActiveDate.getTime() - startDate.getTime();
    return diffMs > 0 ? diffMs : 0;
  } catch (error) {
    return 0;
  }
};

export const Dashboard = () => {
  const { api } = useSDK();
  const [terminalWidth, terminalHeight] = useTerminalSize();
  const [scrollOffset, setScrollOffset] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["runningVms"],
    queryFn: () => api.listRunningVms(),
  });

  // Poll getRunningVms API every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [refetch]);

  const { setView } = useView();

  // Sort VMs by started_at (oldest to newest)
  const sortedVms = data?.vms
    ? [...data.vms].sort((a, b) => {
        if (!a.session_started_at && !b.session_started_at) return 0;
        if (!a.session_started_at) return 1;
        if (!b.session_started_at) return -1;

        const dateA = new Date(a.session_started_at);
        const dateB = new Date(b.session_started_at);

        // Check for invalid dates
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;

        return dateA.getTime() - dateB.getTime();
      })
    : [];

  // Calculate visible rows dynamically based on terminal size
  // Account for UI elements: instructions (1), sandbox label (1), input field (1),
  // table title (1), table header (1), separator (1), bottom margin (2)
  const uiElementRows = 8;
  const maxVisibleRows = Math.max(
    1,
    Math.floor((terminalHeight - uiElementRows) * 0.7) - 3
  );

  const {
    sandboxId,
    selectedVm,
    selectedVmIndex,
    handleInputChange,
    handleInputSubmit,
    handleVmSelect,
  } = useVmInput({
    vms: sortedVms,
    onSubmit: (id: string) => {
      setView({ name: "sandbox", params: { id } });
    },
  });

  // Update scroll offset when selection changes
  useEffect(() => {
    if (selectedVmIndex < 0) {
      // Reset scroll offset when no VM is selected
      setScrollOffset(0);
      return;
    }

    if (sortedVms.length <= maxVisibleRows) {
      // No need to scroll if all items fit
      setScrollOffset(0);
      return;
    }

    // Calculate current visible range
    const currentVisibleStart = scrollOffset;
    const currentVisibleEnd = scrollOffset + maxVisibleRows - 1;

    // If selected item is outside visible area, scroll to include it
    if (selectedVmIndex < currentVisibleStart) {
      // Scroll up to show selected item at top
      setScrollOffset(selectedVmIndex);
    } else if (selectedVmIndex > currentVisibleEnd) {
      // Scroll down to show selected item at bottom
      setScrollOffset(selectedVmIndex - maxVisibleRows + 1);
    }
  }, [selectedVmIndex, maxVisibleRows, sortedVms.length]);

  // Cursor is shown when no VM is selected (user typed manually)
  const showCursor = selectedVm === null;

  const renderVmSection = () => {
    if (isLoading) {
      return (
        <Box flexDirection="column" marginTop={2}>
          <Text>Running VMs</Text>
          <Box borderStyle="round" paddingX={1} paddingY={1}>
            <Text dimColor>Loading VM data...</Text>
          </Box>
        </Box>
      );
    }

    if (sortedVms && sortedVms.length > 0) {
      // TODO: Fix type mismatch - API types are being updated
      return (
        <VmTable
          vms={sortedVms as any}
          selectedIndex={selectedVmIndex}
          onSelect={handleVmSelect}
          scrollOffset={scrollOffset}
          maxVisibleRows={maxVisibleRows}
        />
      );
    }

    return (
      <Box flexDirection="column" marginTop={2}>
        <Text>Running VMs</Text>
        <Box borderStyle="round" paddingX={1} paddingY={1}>
          <Text dimColor>No running VMs found.</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>
          Start typing to input an ID or use ↑/↓ arrows to select from running
          VMs. Press ENTER to view VM details.
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Box width={40}>
          <Text>Sandbox ID</Text>
        </Box>
        <Box width={40}>
          <TextInput
            value={sandboxId}
            onChange={handleInputChange}
            onSubmit={handleInputSubmit}
            showCursor={showCursor}
          />
        </Box>
      </Box>
      {renderVmSection()}
    </Box>
  );
};
