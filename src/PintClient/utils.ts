export function parseStreamEvent<T>(evt: unknown): T {
  if (typeof evt !== "string") {
    return evt as T;
  }

  const evtWithoutDataPrefix = evt.substring(5);

  return JSON.parse(evtWithoutDataPrefix);
}