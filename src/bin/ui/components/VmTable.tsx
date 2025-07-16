import React from "react";
import { Box, Text } from "ink";
import { Table, TableHeader, TableBody, TableRow, TableColumn } from "./Table";
import { format, parseISO } from "date-fns";

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "N/A";
  
  try {
    const date = parseISO(dateString);
    return format(date, "d MMMM yyyy 'at' HH:mm 'UTC'");
  } catch (error) {
    return "Invalid date";
  }
};

const calculateRuntime = (startedAt: string | undefined, lastActiveAt: string | undefined): string => {
  if (!startedAt || !lastActiveAt) {
    return "N/A"
  };
  
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
      result += `${minutes}m `;
    }
    
    if (seconds > 0 || result === "") {
      result += `${seconds}s`;
    }
    
    return result.trim();
  } catch (error) {
    return "N/A";
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
}

export const VmTable = ({ vms, selectedIndex, onSelect }: VmTableProps) => {
  const columnWidths = {
    id: 20,
    lastActive: 28,
    startedAt: 28,
    runtime: 14,
    creditBasis: 20,
  };

  if (vms.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>Running VMs</Text>
        <Text dimColor>No running VMs found.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>Running VMs</Text>
      <Table
        renderHeader={() => (
          <TableHeader>
            <TableColumn width={columnWidths.id} bold>VM ID</TableColumn>
            <TableColumn width={columnWidths.lastActive} bold>Last Active</TableColumn>
            <TableColumn width={columnWidths.startedAt} bold>Started At</TableColumn>
            <TableColumn width={columnWidths.runtime} bold>Runtime</TableColumn>
            <TableColumn width={columnWidths.creditBasis} bold>Credit Basis</TableColumn>
          </TableHeader>
        )}
        renderBody={(totalWidth) => (
          <TableBody totalWidth={totalWidth}>
            {vms.map((vm, index) => (
              <TableRow key={vm.id || index} isSelected={selectedIndex === index}>
                <TableColumn width={columnWidths.id}>{vm.id || "N/A"}</TableColumn>
                <TableColumn width={columnWidths.lastActive}>{formatDate(vm.last_active_at)}</TableColumn>
                <TableColumn width={columnWidths.startedAt}>{formatDate(vm.session_started_at)}</TableColumn>
                <TableColumn width={columnWidths.runtime}>{calculateRuntime(vm.session_started_at, vm.last_active_at)}</TableColumn>
                <TableColumn width={columnWidths.creditBasis}>{vm.credit_basis || "N/A"} credits / hour</TableColumn>
              </TableRow>
            ))}
          </TableBody>
        )}
      />
    </Box>
  );
}; 