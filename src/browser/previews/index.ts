import { Preview } from "./Preview";
import {
  BaseMessageFromPreview,
  BaseMessageToPreview,
  InjectFunction,
  Message,
} from "./types";

export { Preview, InjectFunction };

/**
 * Create a preview that you can interact with. By default you can interact with navigation, but you can also inject your own code and do custom message passing. Append the `iframe` to your DOM to display the preview.
 */
export function createPreview<
  MessageToPreview extends Message = BaseMessageToPreview,
  MessageFromPreview extends Message = BaseMessageFromPreview
>(src: string) {
  return new Preview<MessageToPreview, MessageFromPreview>(src);
}
