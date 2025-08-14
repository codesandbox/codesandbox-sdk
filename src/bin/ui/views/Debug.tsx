import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useView } from "../viewContext";
import { useSDK } from "../sdkContext";
import { useTerminalSize } from "../hooks/useTerminalSize";
import { Port } from "../../../SandboxClient/ports";
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
  
  const [ports, setPorts] = useState<Port[]>([]);
  const [sandboxTerminal, setSandboxTerminal] = useState<Terminal | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // XTerm refs
  const xtermRef = useRef<XTerm | null>(null);
  const serializeRef = useRef<SerializeAddon | null>(null);
  
  const statusBarHeight = 8; // Height for ports display + header
  const terminalRows = Math.max(10, terminalHeight - statusBarHeight - 4);
  const terminalCols = Math.max(40, terminalWidth - 4);

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

        // Get current ports
        const currentPorts = await client.ports.getAll();
        setPorts(currentPorts);

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
          allowProposedApi: true 
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
          portOpenDisposable?.dispose?.();
          portCloseDisposable?.dispose?.();
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
          console.warn('Failed to kill terminal:', error);
        });
      }
      setView({ name: "sandbox", params: { id: view.params.id } });
    } else if (sandboxTerminal && xtermRef.current && !isConnecting) {
      // Handle special keys
      if (key.return) {
        sandboxTerminal.write('\r', { cols: terminalCols, rows: terminalRows });
        // Don't echo to xterm - let the response come back naturally
      } else if (key.backspace || key.delete) {
        // Try both common backspace codes
        const backspaceCode = '\x08'; // Backspace (Ctrl+H)
        sandboxTerminal.write(backspaceCode, { cols: terminalCols, rows: terminalRows });
        // Don't echo to xterm - let the response come back naturally
      } else if (key.leftArrow) {
        sandboxTerminal.write('\x1b[D', { cols: terminalCols, rows: terminalRows });
      } else if (key.rightArrow) {
        sandboxTerminal.write('\x1b[C', { cols: terminalCols, rows: terminalRows });
      } else if (key.upArrow) {
        sandboxTerminal.write('\x1b[A', { cols: terminalCols, rows: terminalRows });
      } else if (key.downArrow) {
        sandboxTerminal.write('\x1b[B', { cols: terminalCols, rows: terminalRows });
      } else if (key.ctrl && input === 'c') {
        sandboxTerminal.write('\x03', { cols: terminalCols, rows: terminalRows });
      } else if (key.tab) {
        sandboxTerminal.write('\t', { cols: terminalCols, rows: terminalRows });
      } else if (input) {
        sandboxTerminal.write(input, { cols: terminalCols, rows: terminalRows });
        // Don't echo regular input to xterm as it will come back via the output handler
      }
    }
  });

  // Instead of rendering directly to stdout, let's capture the terminal content with color info
  const [terminalLines, setTerminalLines] = useState<Array<{text: string, segments: Array<{text: string, color?: string}>, cursorCol?: number}>>([]);
  const [cursorPosition, setCursorPosition] = useState<{row: number, col: number}>({row: 0, col: 0});
  const [lastBufferHash, setLastBufferHash] = useState<string>('');

  // Update terminal content from xterm - with color support
  const updateTerminalContent = useCallback(() => {
    const xterm = xtermRef.current;
    if (!xterm || isConnecting) return;

    try {
      // Get the buffer content line by line with color information
      const buffer = xterm.buffer.active;
      
      // Create a simple hash to detect buffer changes
      const bufferHash = `${buffer.length}-${buffer.baseY}-${buffer.cursorY}-${buffer.cursorX}`;
      if (bufferHash === lastBufferHash) {
        return; // No changes, skip update
      }
      setLastBufferHash(bufferHash);
      
      const lines: Array<{text: string, segments: Array<{text: string, color?: string}>}> = [];
      
      // Force XTerm to scroll to bottom first, then read what it shows
      xterm.scrollToBottom();
      
      // Always show the very end of the buffer - simple approach
      // Add a few extra lines to make sure we don't miss the prompt
      const bufferEnd = buffer.length - 1;
      const displayStart = Math.max(0, bufferEnd - terminalRows - 2);
      const actualBottom = bufferEnd;
      
      // Get cursor position relative to our display window
      const absoluteCursorY = buffer.baseY + buffer.cursorY;
      const relativeCursorY = absoluteCursorY - displayStart;
      const cursorX = buffer.cursorX;
      
      setCursorPosition({ row: relativeCursorY, col: cursorX });
      
      for (let i = displayStart; i <= actualBottom; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const segments: Array<{text: string, color?: string}> = [];
          
          // Extract color information from cells, but only up to the actual content
          let currentSegment = '';
          let currentColor: string | undefined;
          let lineHasContent = false;
          
          // Get the actual width used in this line
          let actualWidth = line.length;
          for (let j = line.length - 1; j >= 0; j--) {
            const cell = line.getCell(j);
            if (cell && cell.getChars().trim()) {
              actualWidth = j + 1;
              break;
            }
          }
          
          for (let cellIndex = 0; cellIndex < actualWidth; cellIndex++) {
            const cell = line.getCell(cellIndex);
            if (cell) {
              const char = cell.getChars();
              const fg = cell.getFgColor();
              
              // Skip null characters but keep spaces
              if (char === '\0') continue;
              
              lineHasContent = lineHasContent || char.trim() !== '';
              
              // Convert XTerm color to a simple color name that Ink supports
              let inkColor: string | undefined;
              if (fg !== 0) {
                // Basic color mapping - XTerm uses different color codes
                switch (fg) {
                  case 1: inkColor = 'red'; break;
                  case 2: inkColor = 'green'; break;
                  case 3: inkColor = 'yellow'; break;
                  case 4: inkColor = 'blue'; break;
                  case 5: inkColor = 'magenta'; break;
                  case 6: inkColor = 'cyan'; break;
                  case 7: inkColor = 'white'; break;
                  default: 
                    // For RGB colors or other codes, try to map to closest basic color
                    if (fg >= 8 && fg <= 15) {
                      const basicColors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
                      inkColor = basicColors[(fg - 8) % basicColors.length];
                    }
                    break;
                }
              }
              
              // If color changed, save current segment and start new one
              if (inkColor !== currentColor) {
                if (currentSegment) {
                  segments.push({ text: currentSegment, color: currentColor });
                }
                currentSegment = char;
                currentColor = inkColor;
              } else {
                currentSegment += char;
              }
            }
          }
          
          // Don't forget the last segment
          if (currentSegment) {
            segments.push({ text: currentSegment, color: currentColor });
          }
          
          // Only add lines that have actual content or are part of the recent output
          if (lineHasContent || segments.length > 0) {
            const lineText = segments.map(s => s.text).join('');
            const lineIndex = i - displayStart;
            lines.push({ 
              text: lineText, 
              segments: segments.length > 0 ? segments : [{ text: lineText || ' ' }],
              cursorCol: lineIndex === relativeCursorY ? cursorX : undefined
            });
          } else {
            // Even for empty lines, we need to maintain the structure to show cursor
            const lineIndex = i - displayStart;
            lines.push({
              text: '',
              segments: [{ text: '' }],
              cursorCol: lineIndex === relativeCursorY ? cursorX : undefined
            });
          }
        }
      }
      
      // Set the lines - they're already the correct count
      setTerminalLines(lines);
    } catch (error) {
      // If buffer access fails, keep previous content
      console.warn('Terminal buffer access error:', error);
    }
  }, [isConnecting, terminalRows, lastBufferHash]);

  useAnimationFrame(updateTerminalContent, 5); // Lower FPS to reduce terminal jumping

  if (!view.params.id) {
    return <Box>No sandbox ID provided. Press escape to go back.</Box>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>Debug - {view.params.id}</Text>

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
              ports.slice(0, 3).map((port) => ( // Limit to 3 ports to save space
                <Box key={port.port}>
                  <Text color="green">Port {port.port}: </Text>
                  <Text>{port.host}</Text>
                </Box>
              ))
            )}
            {ports.length > 3 && (
              <Text dimColor>... and {ports.length - 3} more ports</Text>
            )}
          </Box>

          <Text bold>Terminal:</Text>
        </>
      )}

      {/* Terminal Section */}
      {!isConnecting && (
        <Box flexDirection="column">
          <Box 
            borderStyle="round" 
            borderColor="gray"
            flexDirection="column"
            height={terminalRows + 4}
            width={terminalWidth - 2}
            paddingX={1}
            overflow="hidden"
          >
            {terminalLines.length > 0 ? (
              terminalLines.map((line, lineIndex) => (
                <Box key={lineIndex}>
                  {line.cursorCol !== undefined ? (
                    // Line with cursor - need to split at cursor position
                    <>
                      {line.segments.map((segment, segIndex) => {
                        const segmentStart = line.segments.slice(0, segIndex).reduce((acc, s) => acc + s.text.length, 0);
                        const segmentEnd = segmentStart + segment.text.length;
                        
                        if (line.cursorCol! >= segmentStart && line.cursorCol! < segmentEnd) {
                          // Cursor is within this segment - split it
                          const cursorOffset = line.cursorCol! - segmentStart;
                          const beforeCursor = segment.text.slice(0, cursorOffset);
                          const cursorChar = segment.text.charAt(cursorOffset);
                          const afterCursor = segment.text.slice(cursorOffset + 1);
                          
                          return (
                            <React.Fragment key={segIndex}>
                              {beforeCursor && (
                                <Text color={segment.color as any}>{beforeCursor}</Text>
                              )}
                              <Text backgroundColor="white" color="black">
                                {cursorChar || ' '}
                              </Text>
                              {afterCursor && (
                                <Text color={segment.color as any}>{afterCursor}</Text>
                              )}
                            </React.Fragment>
                          );
                        } else {
                          // Normal segment (cursor not in this segment)
                          return (
                            <Text key={segIndex} color={segment.color as any}>
                              {segment.text}
                            </Text>
                          );
                        }
                      })}
                      {/* Only show cursor at end if it's beyond all existing text */}
                      {line.cursorCol! >= line.text.length && (
                        <Text backgroundColor="white" color="black"> </Text>
                      )}
                    </>
                  ) : (
                    // Line without cursor
                    line.segments.map((segment, segIndex) => (
                      <Text key={segIndex} color={segment.color as any}>
                        {segment.text}
                      </Text>
                    ))
                  )}
                </Box>
              ))
            ) : (
              <Text dimColor>Terminal starting...</Text>
            )}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Type commands normally. Press ESC to go back.
        </Text>
      </Box>
    </Box>
  );
};