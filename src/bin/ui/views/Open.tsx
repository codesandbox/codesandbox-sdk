import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useView } from "../viewContext";
import { useSDK } from "../sdkContext";
import { Port } from "../../../SandboxClient/ports";
import { Task } from "../../../SandboxClient/tasks";

export const Open = () => {
  const { view, setView } = useView<"open">();
  const { sdk } = useSDK();

  const [ports, setPorts] = useState<Port[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize sandbox connection
  useEffect(() => {
    let mounted = true;
    let client: any = null;

    const initializeOpen = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Connect to sandbox with a global user session
        const sandbox = await sdk.sandboxes.resume(view.params.id);
        client = await sandbox.connect({
          id: "open-session",
          permission: "write",
        });

        if (!mounted) return;

        // Get current ports and tasks
        const [currentPorts, currentTasks] = await Promise.all([
          client.ports.getAll(),
          client.tasks.getAll(),
        ]);
        setPorts(currentPorts);
        setTasks(currentTasks);

        // Listen for port changes
        const portOpenDisposable = client.ports.onDidPortOpen((port: Port) => {
          setPorts((prev) => {
            const exists = prev.some((p) => p.port === port.port);
            return exists ? prev : [...prev, port];
          });
        });

        const portCloseDisposable = client.ports.onDidPortClose(
          (portNumber: number) => {
            setPorts((prev) => prev.filter((p) => p.port !== portNumber));
          }
        );

        setIsConnecting(false);

        // Cleanup function
        return () => {
          portOpenDisposable?.dispose?.();
          portCloseDisposable?.dispose?.();
          client?.dispose?.();
        };
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsConnecting(false);
      }
    };

    initializeOpen().then((cleanup) => {
      if (!mounted && cleanup) {
        cleanup();
      }
    });

    return () => {
      mounted = false;
      client?.dispose?.();
    };
  }, [view.params.id, sdk.sandboxes]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      setView({ name: "sandbox", params: { id: view.params.id } });
    }
  });

  if (!view.params.id) {
    return <Box>No sandbox ID provided. Press escape to go back.</Box>;
  }

  return (
    <Box flexDirection="column" overflow="visible">
      <Text bold>Open - {view.params.id}</Text>

      {error && (
        <Box marginY={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {isConnecting ? (
        <Box marginY={1}>
          <Text color="blue">Connecting to sandbox...</Text>
        </Box>
      ) : (
        <>
          {/* Ports Section */}
          <Box flexDirection="column" marginY={1}>
            <Text bold>Active Ports:</Text>
            {ports.length === 0 ? (
              <Text dimColor>No ports currently open</Text>
            ) : (
              ports.map((port) => (
                <Text key={port.port} color="green">
                  Port {port.port}: https://{port.host}
                </Text>
              ))
            )}
          </Box>

          {/* Tasks Section */}
          <Box flexDirection="column" marginY={1}>
            <Text bold>Tasks:</Text>
            {tasks.length === 0 ? (
              <Text dimColor>No tasks defined</Text>
            ) : (
              tasks.map((task) => {
                const status = task.status;
                const statusColor =
                  status === "RUNNING"
                    ? "green"
                    : status === "FINISHED"
                    ? "blue"
                    : status === "ERROR"
                    ? "red"
                    : status === "KILLED"
                    ? "red"
                    : status === "RESTARTING"
                    ? "yellow"
                    : status === "IDLE"
                    ? "gray"
                    : "gray";

                return (
                  <Box key={task.id} flexDirection="row">
                    <Text>{task.name}: </Text>
                    <Text color={statusColor}>{status}</Text>
                  </Box>
                );
              })
            )}
          </Box>
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press ESC to go back to sandbox view.</Text>
      </Box>
    </Box>
  );
};
