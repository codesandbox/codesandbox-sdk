import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { stripVTControlCharacters } from "node:util";
import { useView } from "../viewContext";
import { useSDK } from "../sdkContext";
import { useTerminalSize } from "../hooks/useTerminalSize";
import { Terminal } from "../../../SandboxClient/terminals";
import xtermPkg from "@xterm/headless";
import serializePkg from "@xterm/addon-serialize";

const { Terminal: XTerm } = xtermPkg;
const { SerializeAddon } = serializePkg;

function useAnimationFrame(callback: () => void, fps = 60) {
  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const frame = () => {
      callback();
      t = setTimeout(frame, 1000 / fps);
    };
    frame();
    return () => {
      if (t) clearTimeout(t);
    };
  }, [callback, fps]);
}

export const Debug = () => {
  const { view, setView } = useView<"debug">();
  const { sdk } = useSDK();
  const [terminalWidth, terminalHeight] = useTerminalSize();

  const [sandboxTerminal, setSandboxTerminal] = useState<Terminal | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // XTerm refs
  const xtermRef = useRef<any | null>(null);
  const serializeRef = useRef<any | null>(null);

  // Calculate terminal dimensions based on available space
  const terminalCols = 150;
  // Calculate rows based on terminal height, reserving space for UI elements:
  // - Title (1 row)
  // - Error message (1 row when present)
  // - "Connecting..." message (1 row when present)
  // - Instructions at bottom (2 rows with margin)
  // Total reserved: ~5-6 rows for UI, remaining for terminal content
  const reservedRows = 6; // Minimal UI for terminal-only view
  const availableRows = Math.max(5, terminalHeight - reservedRows); // Minimum 5 rows
  const terminalRows = availableRows;

  // Initialize sandbox connection and terminal
  useEffect(() => {
    let mounted = true;
    let client: any = null;

    const initializeDebug = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Connect to sandbox with a global user session
        const sandbox = await sdk.sandboxes.resume(view.params.id);
        client = await sandbox.connect({
          id: "debug-session",
          permission: "write",
        });

        if (!mounted) return;

        // Create or get existing terminal
        let debugTerminal: Terminal;
        const existingTerminals = await client.terminals.getAll();
        const debugTerminalExists = existingTerminals.find(
          (t) => t.name === "debug-xterm"
        );

        if (debugTerminalExists) {
          debugTerminal = debugTerminalExists;
        } else {
          debugTerminal = await client.terminals.create("bash", {
            name: "debug-xterm",
            dimensions: {
              cols: terminalCols,
              rows: terminalRows,
            },
          });
        }

        if (!mounted) return;

        setSandboxTerminal(debugTerminal);

        // Initialize XTerm
        const xterm = new XTerm({
          cols: terminalCols,
          rows: terminalRows,
          allowProposedApi: true,
        });
        const serialize = new SerializeAddon();
        xterm.loadAddon(serialize);
        xtermRef.current = xterm;
        serializeRef.current = serialize;

        // Open sandbox terminal and get initial output
        const initialOutput = await debugTerminal.open({
          cols: terminalCols,
          rows: terminalRows,
        });

        // Write initial output to xterm
        if (initialOutput) {
          xterm.write(initialOutput);
        }

        // Listen for terminal output and pipe to xterm
        const outputDisposable = debugTerminal.onOutput((output) => {
          if (xtermRef.current) {
            xtermRef.current.write(output);
          }
        });

        setIsConnecting(false);

        // Cleanup function
        return () => {
          outputDisposable?.dispose?.();
          // Kill the terminal session
          if (debugTerminal) {
            debugTerminal.kill().catch(() => {
              // Ignore cleanup errors
            });
          }
          client?.dispose?.();
          xterm?.dispose?.();
        };
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsConnecting(false);
      }
    };

    initializeDebug().then((cleanup) => {
      if (!mounted && cleanup) {
        cleanup();
      }
    });

    return () => {
      mounted = false;
      // Kill terminal on component unmount
      if (sandboxTerminal) {
        sandboxTerminal.kill().catch(() => {
          // Ignore cleanup errors
        });
      }
      client?.dispose?.();
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [view.params.id, sdk.sandboxes, terminalCols, terminalRows]);

  // Handle terminal resizing
  useEffect(() => {
    if (xtermRef.current && sandboxTerminal) {
      xtermRef.current.resize(terminalCols, terminalRows);
      // Note: We don't resize the sandbox terminal as it might disrupt the session
    }
  }, [terminalCols, terminalRows, sandboxTerminal]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      // Kill the terminal before exiting
      if (sandboxTerminal) {
        sandboxTerminal.kill().catch((error) => {
          console.warn("Failed to kill terminal:", error);
        });
      }
      setView({ name: "sandbox", params: { id: view.params.id } });
    } else if (key.shift && (key.upArrow || key.downArrow)) {
      // Handle scrolling with SHIFT + arrow keys
      const buffer = xtermRef.current?.buffer.active;
      if (buffer) {
        const maxScroll = Math.max(0, buffer.length - terminalRows);
        if (key.upArrow) {
          setScrollOffset((prev) => {
            const newOffset = Math.min(prev + 1, maxScroll);
            // Force terminal content update by clearing the buffer hash
            setLastBufferHash("");
            return newOffset;
          });
        } else if (key.downArrow) {
          setScrollOffset((prev) => {
            const newOffset = Math.max(prev - 1, 0);
            // Force terminal content update by clearing the buffer hash
            setLastBufferHash("");
            return newOffset;
          });
        }
      }
    } else if (sandboxTerminal && xtermRef.current && !isConnecting) {
      // Handle special keys
      if (key.return) {
        sandboxTerminal.write("\r", { cols: terminalCols, rows: terminalRows });
        // Don't echo to xterm - let the response come back naturally
      } else if (key.backspace || key.delete) {
        // Try both common backspace codes
        const backspaceCode = "\x08"; // Backspace (Ctrl+H)
        sandboxTerminal.write(backspaceCode, {
          cols: terminalCols,
          rows: terminalRows,
        });
        // Don't echo to xterm - let the response come back naturally
      } else if (key.leftArrow) {
        sandboxTerminal.write("\x1b[D", {
          cols: terminalCols,
          rows: terminalRows,
        });
      } else if (key.rightArrow) {
        sandboxTerminal.write("\x1b[C", {
          cols: terminalCols,
          rows: terminalRows,
        });
      } else if (key.upArrow) {
        sandboxTerminal.write("\x1b[A", {
          cols: terminalCols,
          rows: terminalRows,
        });
      } else if (key.downArrow) {
        sandboxTerminal.write("\x1b[B", {
          cols: terminalCols,
          rows: terminalRows,
        });
      } else if (key.ctrl && input === "c") {
        sandboxTerminal.write("\x03", {
          cols: terminalCols,
          rows: terminalRows,
        });
      } else if (key.tab) {
        sandboxTerminal.write("\t", { cols: terminalCols, rows: terminalRows });
      } else if (input) {
        sandboxTerminal.write(input, {
          cols: terminalCols,
          rows: terminalRows,
        });
        // Don't echo regular input to xterm as it will come back via the output handler
      }
    }
  });

  // Simple terminal content - single text block
  const [terminalContent, setTerminalContent] = useState<string>("");
  const [lastBufferHash, setLastBufferHash] = useState<string>("");
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  // Simple terminal content update - no line splitting needed
  const updateTerminalContent = useCallback(() => {
    const xterm = xtermRef.current;
    const serialize = serializeRef.current;
    if (!xterm || !serialize || isConnecting) return;

    try {
      const buffer = xterm.buffer.active;

      // Create a hash to detect changes
      const bufferHash = `${buffer.length}-${buffer.baseY}-${buffer.viewportY}-${buffer.cursorY}-${buffer.cursorX}`;
      if (bufferHash === lastBufferHash) {
        return; // No changes, skip update
      }
      setLastBufferHash(bufferHash);

      // Don't scroll - let the terminal frame extend naturally

      // Use serialize addon with proper cleaning to prevent accumulation
      try {
        const buffer = xterm.buffer.active;
        const cursorX = buffer.cursorX;
        const cursorY = buffer.cursorY;

        // Get full terminal content first
        const fullContent =
          serializeRef.current?.serialize({
            scrollback: buffer.length, // Get all content
            excludeAltBuffer: false,
            onlySelection: false,
          }) || "";

        // Split into lines and apply scroll offset to get consistent window
        const allLines = fullContent.split("\n");
        const totalLines = allLines.length;

        // Calculate which lines to show based on scroll offset
        const startLine = Math.max(0, totalLines - terminalRows - scrollOffset);
        const endLine = Math.min(totalLines, startLine + terminalRows);
        const visibleLines = allLines.slice(startLine, endLine);

        // Pad with empty lines if needed to maintain consistent height
        while (visibleLines.length < terminalRows) {
          visibleLines.push("");
        }

        const serializedContent = visibleLines.join("\n");

        // Calculate cursor position relative to visible window
        const cursorLineInBuffer = cursorY + (buffer.length - terminalRows);
        const adjustedCursorY = cursorLineInBuffer - startLine;

        // Aggressively clean any existing cursor codes to prevent accumulation
        const cleanContent = serializedContent
          .replace(/\x1b\[7m/g, "") // Remove inverse video start
          .replace(/\x1b\[27m/g, "") // Remove inverse video end
          .replace(/\x1b\[39m/g, "") // Remove reset foreground
          .replace(/\x1b\[49m/g, "") // Remove reset background
          .replace(/\x1b\[7m \x1b\[27m\x1b\[39m\x1b\[49m/g, ""); // Remove complete cursor sequence

        // Calculate cursor position in clean content using viewport-relative coordinates
        const cleanTextContent = stripVTControlCharacters(cleanContent);
        const cleanLines = cleanTextContent.split("\n");
        let targetPosition = 0;

        // Use the adjusted cursor position
        const finalCursorY = adjustedCursorY;

        for (let i = 0; i < finalCursorY && i < cleanLines.length; i++) {
          targetPosition += cleanLines[i].length + 1;
        }

        if (finalCursorY < cleanLines.length) {
          const currentLine = cleanLines[finalCursorY] || "";
          targetPosition += Math.min(cursorX, currentLine.length);
        }

        // Map to position in original content with ANSI codes
        let actualPosition = 0;
        let cleanPosition = 0;

        while (
          cleanPosition < targetPosition &&
          actualPosition < cleanContent.length
        ) {
          const char = cleanContent.charAt(actualPosition);

          if (
            char === "\x1b" &&
            cleanContent.charAt(actualPosition + 1) === "["
          ) {
            let seqEnd = actualPosition + 2;
            while (seqEnd < cleanContent.length) {
              const seqChar = cleanContent.charAt(seqEnd);
              seqEnd++;
              if (
                (seqChar >= "A" && seqChar <= "Z") ||
                (seqChar >= "a" && seqChar <= "z")
              ) {
                break;
              }
            }
            actualPosition = seqEnd;
          } else {
            actualPosition++;
            cleanPosition++;
          }
        }

        // Try to split content at cursor position and render with React components
        const beforeCursor = cleanContent.substring(0, actualPosition);
        const charAtCursor = cleanContent.charAt(actualPosition);
        const afterCursor = cleanContent.substring(actualPosition + 1);

        // Check if cursor is at the very end of the buffer (no character to highlight)
        const isAtEnd = !charAtCursor;

        // Check if cursor is on an ANSI escape sequence
        const isOnEscapeSequence =
          charAtCursor === "\x1b" ||
          (beforeCursor.endsWith("\x1b[") && charAtCursor === "?");

        if (isAtEnd) {
          // Cursor is at the end - just show clean content without appending cursor
          setTerminalContent(cleanContent);
        } else if (!isOnEscapeSequence) {
          // Cursor is on an actual character (not escape sequence) - highlight it
          setTerminalContent(
            JSON.stringify({
              before: beforeCursor,
              cursor: charAtCursor,
              after: afterCursor,
            })
          );
        } else {
          // Cursor is on escape sequence - don't render a cursor to avoid breaking ANSI
          setTerminalContent(cleanContent);
        }
      } catch (error) {
        console.warn("Terminal serialization error:", error);
      }
    } catch (error) {
      console.warn("Terminal buffer access error:", error);
    }
  }, [isConnecting, lastBufferHash, scrollOffset]);

  useAnimationFrame(updateTerminalContent, 15); // Responsive scrolling for prompt visibility

  if (!view.params.id) {
    return <Box>No sandbox ID provided. Press escape to go back.</Box>;
  }

  return (
    <Box flexDirection="column" overflow="visible">
      <Text bold>Terminal - {view.params.id}</Text>

      {error && (
        <Box marginY={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {isConnecting && (
        <Box marginY={1}>
          <Text color="blue">Connecting to sandbox...</Text>
        </Box>
      )}

      {/* Terminal Section - Allow content to flow naturally */}
      {!isConnecting && (
        <Box flexDirection="column" minHeight={terminalRows} overflow="visible">
          {terminalContent ? (
            (() => {
              try {
                const parsed = JSON.parse(terminalContent);
                return (
                  <Text>
                    {parsed.before}
                    <Text backgroundColor="white" color="black">
                      {parsed.cursor}
                    </Text>
                    {parsed.after}
                  </Text>
                );
              } catch {
                return <Text>{terminalContent}</Text>;
              }
            })()
          ) : (
            <Text dimColor>Terminal starting...</Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Type commands normally. SHIFT + ↑/↓ to scroll. Press ESC to go back.
        </Text>
      </Box>
    </Box>
  );
};
