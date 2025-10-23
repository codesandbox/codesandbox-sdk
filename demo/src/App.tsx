import { useState, useEffect } from "react";
import { connectToSandbox, SandboxClient } from "@codesandbox/sdk/browser";
import type { SandboxSession } from "@codesandbox/sdk";
import "./App.css";

type ConnectionState =
  | "IDLE"
  | "CREATING"
  | "CONNECTED"
  | "CONNECTING"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "HIBERNATED"
  | "ERROR";

const STORAGE_KEY = "codesandbox_demo_sandbox_id";

function App() {
  const [client, setClient] = useState<SandboxClient | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("IDLE");
  const [sandboxId, setSandboxId] = useState<string>("");
  const [inputSandboxId, setInputSandboxId] = useState<string>("");
  const [storedSandboxId, setStoredSandboxId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY)
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!client) return;

    // Listen to state changes
    const disposable = client.onStateChange((state) => {
      setConnectionState(state);
    });

    return () => {
      disposable.dispose();
    };
  }, [client]);

  const connectToExistingSandbox = async (id: string) => {
    try {
      setConnectionState("CONNECTING");
      setError("");

      // Fetch session from backend
      const response = await fetch(`/api/sandboxes/${id}`).catch(() => {
        throw new Error(
          "Cannot connect to server. Make sure the dev server is running with: npm run dev"
        );
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get sandbox session: ${response.statusText}`
        );
      }

      const session: SandboxSession = await response.json();
      setSandboxId(session.sandboxId);

      // Store in local storage
      localStorage.setItem(STORAGE_KEY, session.sandboxId);
      setStoredSandboxId(session.sandboxId);

      // Connect to the sandbox
      const sandboxClient = await connectToSandbox({
        session,
        getSession: async (id: string) => {
          const res = await fetch(`/api/sandboxes/${id}`).catch(() => {
            throw new Error(
              "Cannot connect to server. Make sure the dev server is running."
            );
          });
          if (!res.ok) {
            throw new Error(`Failed to get session: ${res.statusText}`);
          }
          return res.json();
        },
        initStatusCb: (event) => {
          console.log("Init status:", event);
        },
      });

      setClient(sandboxClient);
      setConnectionState(sandboxClient.state);
    } catch (err) {
      setConnectionState("ERROR");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      console.error("Failed to connect to sandbox:", err);
    }
  };

  const createSandbox = async () => {
    try {
      setConnectionState("CREATING");
      setError("");

      // Fetch session from backend
      const response = await fetch("/api/sandboxes", {
        method: "POST",
      }).catch(() => {
        throw new Error(
          "Cannot connect to server. Make sure the dev server is running with: npm run dev"
        );
      });

      if (!response.ok) {
        throw new Error(`Failed to create sandbox: ${response.statusText}`);
      }

      const session: SandboxSession = await response.json();

      // Connect to the newly created sandbox
      await connectToExistingSandbox(session.sandboxId);
    } catch (err) {
      setConnectionState("ERROR");
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      console.error("Failed to create sandbox:", err);
    }
  };

  const connectToInputSandbox = async () => {
    if (!inputSandboxId.trim()) {
      setError("Please enter a sandbox ID");
      return;
    }
    await connectToExistingSandbox(inputSandboxId.trim());
  };

  const connectToStoredSandbox = async () => {
    if (!storedSandboxId) {
      setError("No previously created sandbox found");
      return;
    }
    await connectToExistingSandbox(storedSandboxId);
  };

  const reconnect = async () => {
    if (!client) return;
    try {
      setError("");
      await client.reconnect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconnect");
      console.error("Failed to reconnect:", err);
    }
  };

  const disconnect = () => {
    if (!client) return;
    client.disconnect();
  };

  const getStateColor = (state: ConnectionState) => {
    switch (state) {
      case "CONNECTED":
        return "#10b981";
      case "CONNECTING":
      case "RECONNECTING":
      case "CREATING":
        return "#f59e0b";
      case "DISCONNECTED":
      case "HIBERNATED":
        return "#6b7280";
      case "ERROR":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <>
      <h1>CodeSandbox SDK Demo</h1>

      <div className="card">
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: getStateColor(connectionState),
                transition: "background-color 0.3s",
              }}
            />
            <strong>Status:</strong> {connectionState}
          </div>

          {sandboxId && (
            <p style={{ fontSize: "0.9em", color: "#888", margin: "0.5rem 0" }}>
              <strong>Current Sandbox ID:</strong> <code>{sandboxId}</code>
            </p>
          )}

          {storedSandboxId && storedSandboxId !== sandboxId && (
            <p style={{ fontSize: "0.9em", color: "#888", margin: "0.5rem 0" }}>
              <strong>Stored Sandbox ID:</strong> <code>{storedSandboxId}</code>
            </p>
          )}

          {error && (
            <p
              style={{
                color: "#ef4444",
                fontSize: "0.9em",
                margin: "0.5rem 0",
              }}
            >
              Error: {error}
            </p>
          )}
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1em", marginBottom: "0.5rem" }}>
            Create New Sandbox
          </h3>
          <button
            onClick={createSandbox}
            disabled={
              connectionState === "CREATING" ||
              connectionState === "CONNECTING" ||
              client !== null
            }
          >
            Create & Connect to Sandbox
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1em", marginBottom: "0.5rem" }}>
            Connect to Existing Sandbox
          </h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Enter Sandbox ID"
              value={inputSandboxId}
              onChange={(e) => setInputSandboxId(e.target.value)}
              disabled={client !== null}
              style={{
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                flex: "1",
                minWidth: "200px",
              }}
            />
            <button
              onClick={connectToInputSandbox}
              disabled={
                !inputSandboxId.trim() ||
                connectionState === "CONNECTING" ||
                client !== null
              }
            >
              Connect
            </button>
          </div>
        </div>

        {storedSandboxId && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1em", marginBottom: "0.5rem" }}>
              Reconnect to Previous Sandbox
            </h3>
            <button
              onClick={connectToStoredSandbox}
              disabled={connectionState === "CONNECTING" || client !== null}
            >
              Connect to Stored Sandbox ({storedSandboxId.substring(0, 8)}...)
            </button>
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1em", marginBottom: "0.5rem" }}>
            Connection Controls
          </h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={reconnect}
              disabled={
                !client ||
                connectionState === "CONNECTED" ||
                connectionState === "CONNECTING" ||
                connectionState === "RECONNECTING"
              }
            >
              Reconnect
            </button>

            <button
              onClick={disconnect}
              disabled={!client || connectionState === "DISCONNECTED"}
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <p className="read-the-docs">
        Using <code>@codesandbox/sdk/browser</code> to connect to sandboxes
      </p>
    </>
  );
}

export default App;
