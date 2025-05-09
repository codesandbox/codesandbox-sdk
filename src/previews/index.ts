import { Preview } from "./Preview";
import { InjectFunction } from "./types";

export { Preview, InjectFunction };

export function createPreview(src: string) {
  return new Preview(src);
}
