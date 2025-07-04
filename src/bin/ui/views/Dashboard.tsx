import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useView } from "../viewContext";
import { getRunningVms } from "../api";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "../sdkContext";

export const Dashboard = () => {
  const { apiClient } = useSDK();

  const { data, isLoading } = useQuery({
    queryKey: ["runningVms"],
    queryFn: () => getRunningVms(apiClient),
  });

  const [sandboxId, setSandboxId] = useState("");
  const [isFocused, setIsFocused] = useState(true);

  const { setView } = useView();

  // TODO: Create custom input component
  useInput((input, key) => {
    if (key.return) {
      if (sandboxId.trim()) {
        setView({ name: "sandbox", params: { id: sandboxId } });
      }
    } else if (key.backspace || key.delete) {
      setSandboxId((prev) => prev.slice(0, -1));
    } else if (
      input &&
      !key.ctrl &&
      !key.meta &&
      !key.shift &&
      !key.upArrow &&
      !key.downArrow
    ) {
      // Only add printable characters
      setSandboxId((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Enter Sandbox ID: </Text>
        <Text color={isFocused ? "green" : undefined}>{sandboxId || "_"}</Text>
      </Box>
      <Box>
        <Text dimColor>Type to input ID, press ENTER to open</Text>
      </Box>
      {data?.vms && data.vms.length > 0 && (
        <Box flexDirection="column" marginTop={2}>
          <Text bold>Running VMs:</Text>
          <Box flexDirection="column" marginLeft={2}>
            {data.vms.map((vm) => (
              <Text key={vm.id}>• {vm.id}</Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
