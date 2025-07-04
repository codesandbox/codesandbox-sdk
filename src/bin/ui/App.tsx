import React from "react";
import { Box } from "ink";
import { Dashboard } from "./views/Dashboard";
import { useView } from "./viewContext";
import { Sandbox } from "./views/Sandbox";
import { useTerminalSize } from "./hooks/useTerminalSize";

export function App() {
  const [stdoutWidth, stdoutHeight] = useTerminalSize();
  const { view } = useView();

  return (
    <Box flexDirection="column" width={stdoutWidth} height={stdoutHeight}>
      {view.name === "dashboard" && <Dashboard />}
      {view.name === "sandbox" && <Sandbox />}
    </Box>
  );
}
