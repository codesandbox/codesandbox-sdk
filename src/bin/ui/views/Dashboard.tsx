import React from "react";
import { Box, Text } from "ink";
import { useView } from "../viewContext";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "../sdkContext";
import { TextInput } from "../components/TextInput";
import { VmTable } from "../components/VmTable";
import { useVmInput } from "../hooks/useVmInput";

export const Dashboard = () => {
  const { api } = useSDK();

  const { data, isLoading } = useQuery({
    queryKey: ["runningVms"],
    queryFn: () => api.listRunningVms(),
  });

  const { setView } = useView();

  const {
    sandboxId,
    selectedVm,
    selectedVmIndex,
    handleInputChange,
    handleInputSubmit,
    handleVmSelect,
  } = useVmInput({
    vms: data?.vms,
    onSubmit: (id: string) => {
      setView({ name: "sandbox", params: { id } });
    },
  });

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

    if (data?.vms && data.vms.length > 0) {
      // TODO: Fix type mismatch - API types are being updated
      return (
        <VmTable
          vms={data.vms as any}
          selectedIndex={selectedVmIndex}
          onSelect={handleVmSelect}
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
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text dimColor>
          Start typing to input an ID or use ↑/↓ arrows to select from running
          VMs. Press ENTER to view VM details.
        </Text>
      </Box>
      <Box flexDirection="column">
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
