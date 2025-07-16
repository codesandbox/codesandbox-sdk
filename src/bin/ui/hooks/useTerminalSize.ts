import { useStdout } from "ink";
import { useEffect, useState } from "react";

export function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState([stdout?.columns || 80, stdout?.rows || 24]);
  useEffect(() => {
    if (!stdout) return undefined;
    const handler = () => setSize([stdout.columns, stdout.rows]);
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);
  return size;
}
