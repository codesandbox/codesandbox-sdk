import { Preview } from "./Preview";
import {
  BaseMessageFromPreview,
  BaseMessageToPreview,
  InjectFunction,
  Message,
} from "./types";

export { Preview, InjectFunction };

export function createPreview<
  MessageToPreview extends Message = BaseMessageToPreview,
  MessageFromPreview extends Message = BaseMessageFromPreview
>(src: string) {
  return new Preview<MessageToPreview, MessageFromPreview>(src);
}
