/**
 * Messages sent from this context, into the iFrame
 */
export type BaseMessageToPreview =
  | {
      type: "REFRESH";
    }
  | {
      type: "GO_BACK";
    }
  | {
      type: "GO_FORWARD";
    };

/**
 * Messages sent from the iFrame, into this context
 */
export type BaseMessageFromPreview =
  | {
      type: "SET_URL";
      url: string;
      back: boolean;
      forward: boolean;
    }
  | { type: "RELOAD" }
  | { type: "PREVIEW_UNLOADING" };

export const INJECT_MESSAGE_TYPE = "INJECT_AND_INVOKE";
export const HAS_PREVIEW_LOADED_MESSAGE_TYPE = "HAS_PREVIEW_LOADED";
export const PREVIEW_LOADED_MESSAGE_TYPE = "PREVIEW_LOADED";
export const PREVIEW_UNLOADING_MESSAGE_TYPE = "PREVIEW_UNLOADING";
export const INJECT_SUCCESS_TYPE = "INJECT_SUCCESS";

/**
 * This interface is exposed globally on the window of the preview. This allows other libraries to create
 * debugging experiences in the CodeSandbox previews. For example a library can allow you to open files
 * directly in the editors from the preview. The implementation of this interface is different for the
 * preview in the editor (post message to parent) and the inline preview where the message is passed to
 * the embedded inline preview iframe
 */
export type GlobalPreviewApi = {
  focusFile(): void;
};

type BaseScope = Record<string, unknown>;

export interface Message {
  type: string;
}

export interface UIDMessage {
  type: string;
  uid: string;
}

export interface StatusMessage extends UIDMessage {
  type: typeof INJECT_SUCCESS_TYPE;
}

export interface ReadyMessage extends Message {
  type: typeof PREVIEW_LOADED_MESSAGE_TYPE;
}

export interface ReadyRequest extends Message {
  type: typeof HAS_PREVIEW_LOADED_MESSAGE_TYPE;
}

export interface UnloadingMessage extends Message {
  type: typeof PREVIEW_UNLOADING_MESSAGE_TYPE;
}

export interface InjectMessage<Scope = BaseScope> extends UIDMessage {
  type: typeof INJECT_MESSAGE_TYPE;
  /* A stringified function that will be called inside the iFrame. */
  code: string;
  /* The scope that will be passed to the injected code, as `options.scope`. */
  scope: Scope;
}

export type InjectFunction<
  IncomingMessage extends Message,
  OutgoingMessage extends Message,
  Scope = Record<string, unknown>
> = (injectOptions: {
  previewWindow: Window;
  previewProtocol: PreviewProtocolType<IncomingMessage, OutgoingMessage>;
  scope: Scope;
}) => void;

export type Listener = (message: Message) => void;

export interface PreviewProtocolType<
  IncomingMessage extends Message,
  OutgoingMessage extends Message
> {
  addListener<Type extends IncomingMessage["type"]>(
    type: Type,
    listener: (
      message: IncomingMessage extends { type: Type } ? IncomingMessage : never
    ) => void
  ): void;
  sendMessage(message: OutgoingMessage): void;
}
