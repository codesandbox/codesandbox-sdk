import { Emitter } from "@codesandbox/pitcher-client";
import {
  BaseMessageToPreview,
  BaseMessageFromPreview,
  InjectFunction,
  InjectMessage,
  Message,
} from "./types";
import { Disposable } from "../../../utils/disposable";
import { injectAndInvokeInsidePreview } from "./preview-script";

type PreviewStatus = "DISCONNECTED" | "CONNECTED";

export class Preview<
  MessageToPreview extends Message = BaseMessageToPreview,
  MessageFromPreview extends Message = BaseMessageFromPreview
> {
  private subscribers: Set<
    (message: MessageFromPreview | BaseMessageFromPreview) => void
  > = new Set();
  private _status: PreviewStatus = "DISCONNECTED";
  get status() {
    return this._status;
  }
  private set status(status: PreviewStatus) {
    this._status = status;
    this.onStatusChangeEmitter.fire(status);
  }
  private origin: string;
  private windowListener: (event: MessageEvent) => void;
  private onPreviewLoad: () => void;
  private onStatusChangeEmitter = new Emitter<PreviewStatus>();

  onStatusChange = this.onStatusChangeEmitter.event;
  iframe: HTMLIFrameElement;

  constructor(sessionDisposable: Disposable, src: string) {
    sessionDisposable.onWillDispose(() => {
      this.dispose();
    });
    this.origin = new URL(src).origin;
    this.iframe = this.createIframe(src);
    this.windowListener = (event: MessageEvent) => {
      if (event.origin !== this.origin) return;
      if (event.source !== this.iframe.contentWindow) return;

      const message = event.data as MessageFromPreview;

      if (message.type === "PREVIEW_UNLOADING") {
        this.status = "DISCONNECTED";
      }

      if (
        !message.type ||
        message.type.startsWith("INJECT_") ||
        message.type === "TO_DEVTOOL"
      ) {
        return;
      }

      this.subscribers.forEach((onMessage) => {
        onMessage(event.data);
      });
    };

    this.onPreviewLoad = () => {
      this.status = "CONNECTED";
      console.log("INJECT SCRIPT");
      this._injectAndInvoke(injectAndInvokeInsidePreview, {});
    };

    window.addEventListener("message", this.windowListener);
    this.iframe.addEventListener("load", this.onPreviewLoad);
  }

  private createIframe(src: string) {
    const iframe = document.createElement("iframe");
    iframe.allow =
      "clipboard-read; clipboard-write; accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; xr-spatial-tracking; cross-origin-isolated";
    // The 'sandbox' attribute is readonly after the iframe is added to the DOM.
    // Set it before appending to the DOM or setting 'src'.
    iframe.setAttribute(
      "sandbox",
      "allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
    );

    iframe.src = src;

    return iframe;
  }

  private sendMessage(message: MessageToPreview | BaseMessageToPreview) {
    if (this.status === "CONNECTED") {
      this.iframe.contentWindow?.postMessage(message, "*");
    }
  }

  private _injectAndInvoke<
    Incoming extends Message,
    Outgoing extends Message,
    Scope extends Record<string, unknown>
  >(func: InjectFunction<Incoming, Outgoing, Scope>, scope: Scope) {
    if (this.status === "CONNECTED") {
      const injectMessage: InjectMessage<Scope> = {
        code: `exports.activate = ${func.toString()}`,
        type: "INJECT_AND_INVOKE",
        uid: "TODO", // TODO: supply a unique id from the workspace feature.
        scope,
      };
      this.iframe.contentWindow?.postMessage(injectMessage, "*");
    }
  }

  injectAndInvoke<Scope extends Record<string, unknown>>(
    func: InjectFunction<MessageToPreview, MessageFromPreview, Scope>,
    scope: Scope
  ) {
    this._injectAndInvoke(func, scope);
  }

  onMessage(
    subscriber: (message: MessageFromPreview | BaseMessageFromPreview) => void
  ) {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }
  refresh() {
    this.sendMessage({
      type: "REFRESH",
    });
  }
  setUrl(url: string) {
    this.iframe.src = url;
  }
  back() {
    this.sendMessage({
      type: "GO_BACK",
    });
  }
  forward() {
    this.sendMessage({
      type: "GO_FORWARD",
    });
  }
  dispose() {
    this.subscribers.clear();
    this.status = "DISCONNECTED";
    window.removeEventListener("message", this.windowListener);
    this.iframe.removeEventListener("load", this.onPreviewLoad);
  }
}
