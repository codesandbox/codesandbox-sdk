import React from "react";
import { Box, Text } from "ink";
import { format, parseISO } from "date-fns";
import { useTerminalSize } from "../hooks/useTerminalSize";

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "N/A";

  try {
    const date = parseISO(dateString);
    return format(date, "MMM d HH:mm");
  } catch (error) {
    return "Invalid";
  }
};

const calculateRuntime = (
  startedAt: string | undefined,
  lastActiveAt: string | undefined
): string => {
  if (!startedAt || !lastActiveAt) {
    return "N/A";
  }

  try {
    const startDate = parseISO(startedAt);
    const lastActiveDate = parseISO(lastActiveAt);

    // Calculate difference in milliseconds
    const diffMs = lastActiveDate.getTime() - startDate.getTime();

    if (diffMs < 0) return "N/A";

    // Convert to seconds, minutes, hours
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format output
    let result = "";

    if (hours > 0) {
      result += `${hours}h `;
    }

    if (minutes > 0) {
      result += `${minutes}m`;
    } else if (hours === 0) {
      // Only show seconds if less than 1 minute total
      result += `${seconds}s`;
    }

    return result.trim();
  } catch (error) {
    return "N/A";
  }
};

const calculateRuntimeMs = (
  startedAt: string | undefined,
  lastActiveAt: string | undefined
): number => {
  if (!startedAt || !lastActiveAt) {
    return 0;
  }

  try {
    const startDate = parseISO(startedAt);
    const lastActiveDate = parseISO(lastActiveAt);

    const diffMs = lastActiveDate.getTime() - startDate.getTime();
    return diffMs > 0 ? diffMs : 0;
  } catch (error) {
    return 0;
  }
};

interface VmData {
  id?: string;
  credit_basis?: string;
  last_active_at?: string;
  session_started_at?: string;
  specs?: {
    cpu?: number;
    memory?: number;
    storage?: number;
  };
}

interface VmTableProps {
  vms: VmData[];
  selectedIndex: number;
  onSelect: (index: number, vmId: string) => void;
  scrollOffset?: number;
  maxVisibleRows: number;
}

export const VmTable = ({
  vms,
  selectedIndex,
  onSelect,
  scrollOffset = 0,
  maxVisibleRows,
}: VmTableProps) => {
  const [terminalWidth, terminalHeight] = useTerminalSize();

  // VMs are already sorted when passed in
  const vmsSorted = vms;

  // Calculate scroll window
  const startIndex = scrollOffset;
  const endIndex = Math.min(startIndex + maxVisibleRows, vmsSorted.length);
  const visibleVms = vmsSorted.slice(startIndex, endIndex);

  if (vms.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text>Running VMs (0)</Text>
        <Text dimColor>No running VMs found.</Text>
      </Box>
    );
  }

  // Create title with scroll position
  const titleText =
    vmsSorted.length <= maxVisibleRows
      ? `Running VMs (${vmsSorted.length})`
      : `Running VMs (${startIndex + 1}-${endIndex} / ${vmsSorted.length})`;

  // Pad or truncate strings to fixed widths
  const padString = (str: string, width: number) => {
    return str.padEnd(width).substring(0, width);
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Text bold color="blue">
          {padString("VM ID", 14)} {padString("Last Active", 14)}{" "}
          {padString("Started At", 14)} {padString("Runtime", 10)} Credits
        </Text>
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{"─".repeat(Math.min(terminalWidth - 2, 60))}</Text>
      </Box>

      {/* Data rows */}
      {visibleVms.map((vm, visibleIndex) => {
        const actualIndex = startIndex + visibleIndex;
        const isSelected = selectedIndex === actualIndex;

        // Safely get VM ID and handle edge cases
        const vmId = vm?.id && typeof vm.id === "string" ? vm.id : "N/A";

        // Skip rendering if VM is completely invalid
        if (!vm) {
          return (
            <Box key={`invalid-${actualIndex}`}>
              <Text color="red">INVALID_VM[{actualIndex}]</Text>
            </Box>
          );
        }

        return (
          <Box key={`${vmId}-${actualIndex}`}>
            <Text
              backgroundColor={isSelected ? "blue" : undefined}
              color={isSelected ? "white" : undefined}
            >
              {padString(vmId, 14)}{" "}
              {padString(formatDate(vm.last_active_at), 14)}{" "}
              {padString(formatDate(vm.session_started_at), 14)}{" "}
              {padString(
                calculateRuntime(vm.session_started_at, vm.last_active_at),
                10
              )}{" "}
              {vm.credit_basis || "N/A"} cr/hr
            </Text>
          </Box>
        );
      })}

      {/* VM count and range info */}
      <Box marginTop={1}>
        <Text dimColor>
          {vmsSorted.length <= maxVisibleRows
            ? `${vmsSorted.length} VMs total`
            : `Showing ${startIndex + 1}-${endIndex} of ${
                vmsSorted.length
              } VMs`}
        </Text>
      </Box>
    </Box>
  );
};
