import WebSocket from "isomorphic-ws";
import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { SerialQueue } from "./SerialQueue";

export type WebsocketData = string | Uint8Array;

export type DisconnectedEvent = {
  code: number;
  reason: string;
  wasClean: boolean;
};

const readyStateToString = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];

/*
  This WebsocketClient is responsible for a single connection. That means when a disconnect happens a new WebsocketClient will be created. The
  responsibility of this client is to keep the connection alive, detect disconnects and of course send messages. The following scenarios will cause
  a disconnect event to trigger:

  - Close listener
  - Error listener
  - Sending message during closing/closed
  - Late pong detection

  It is PitcherClient itself that is responsible for creating and disposing of WebsocketClients. It will do this when:

  - Disconnected event received
  - Hibernation
  - Seamless forking
  - Explicit disconnect
  - Explicit reconnect

  This creates a one way flow where a disposal from PitcherClient will not suddenly create a disconnected event, and when a disconnect
  is detected it will not suddenly dispose of the instance.
*/
export class WebSocketClient extends Disposable {
  private ws: WebSocket;
  private bufferQueue = new SerialQueue("websocket-buffer-queue");
  private onMessageEmitter: Emitter<Uint8Array> = new Emitter();
  /**
   * Whenever we are disconnected we will create a new WebSocketClient
   */
  private onDisconnectedEmitter: Emitter<{
    code: number;
    wasClean: boolean;
    reason: string;
  }> = new Emitter();

  onMessage = this.onMessageEmitter.event;
  onDisconnected = this.onDisconnectedEmitter.event;

  lastActivity = Date.now();

  // It receives a connected websocket connection
  constructor(ws: WebSocket) {
    super();

    if (ws.readyState !== ws.OPEN) {
      throw new Error("Requires an OPEN websocket connection");
    }

    this.ws = ws;
    this.lastActivity = Date.now();

    const onMessageListener = (event: { data: WebsocketData }) => {
      this.lastActivity = Date.now();

      const data = event.data;

      // Browser environment
      if (typeof window !== "undefined" && data instanceof window.Blob) {
        // To ensure that messages are emitted in order we use a serial queue

        this.bufferQueue.add(async () => {
          this.emitMessage(new Uint8Array(await data.arrayBuffer()));
        });

        return;
      }

      // Node environment
      if (typeof data !== "string") {
        this.emitMessage(data);
        return;
      }
    };

    const onErrorListener = () => {
      // We only want to dispose if we are actually moving towards a closing state,
      // as we might send a message in CONNECTING state as well, which should not
      // dispose of the WS
      if (this.isClosingOrClosed()) {
        this.onDisconnectedEmitter.fire({
          code: -1,
          reason: "Error listener - " + readyStateToString[ws.readyState],
          wasClean: false,
        });
      }
    };

    const onCloseListener = ({
      wasClean,
      code,
      reason,
    }: {
      wasClean: boolean;
      code: number;
      reason: string;
    }) =>
      this.onDisconnectedEmitter.fire({
        wasClean,
        code,
        reason: "Close listener - " + reason,
      });

    ws.addEventListener("message", onMessageListener);
    ws.addEventListener("close", onCloseListener);
    // This happens when we try to send a message in an invalid state
    ws.addEventListener("error", onErrorListener);

    this.onWillDispose(() => {
      ws.removeEventListener("close", onCloseListener);
      ws.removeEventListener("message", onMessageListener);
      ws.removeEventListener("error", onErrorListener);

      this.onMessageEmitter.dispose();
      this.onDisconnectedEmitter.dispose();
      this.ws.close();
    });
  }

  private isClosingOrClosed() {
    return (
      this.ws.readyState === this.ws.CLOSING ||
      this.ws.readyState === this.ws.CLOSED
    );
  }

  private emitMessage(message: Uint8Array) {
    this.onMessageEmitter.fire(message);
  }

  send(data: WebsocketData) {
    // To avoid showing a bunch of errors when we already know the connection is down, we return early. A closing
    // handshake can take up to 30 seconds, so this will help to more quickly close the connection related to
    // interaction where we do want to detect it as fast as possible
    if (this.isClosingOrClosed()) {
      this.onDisconnectedEmitter.fire({
        code: -1,
        reason: "WebSocket not in an open state",
        wasClean: false,
      });
      throw new Error(
        "Could not send message in " +
          readyStateToString[this.ws.readyState] +
          " state"
      );
    }

    // Update lastActivity on send to prevent heartbeat suppression
    this.lastActivity = Date.now();

    // This is an async operation in Node, but to avoid wrapping every send in a promise, we
    // rely on the error listener to deal with any errors. Any unsent messages will be timed out
    // by our PendingMessage logic
    this.ws.send(data);
  }

  /**
   * Closes the connection, triggering a disconnected event
   */
  close() {
    this.ws.close();
  }

  dispose(reason?: string) {
    if (this.isDisposed) {
      return;
    }

    // When we dispose without an event it means we just want to get rid of the instance and
    // not fire any events related to it
    if (!reason) {
      reason = "DISPOSED";
    }

    // Triggers disposal of any internal event listeners, intervals and any external listeners
    super.dispose();
  }
}

export const createWebSocketClient = (url: string) =>
  new Promise<WebSocketClient>((resolve, reject) => {
    const ws = new WebSocket(url);

    const openListener = () => {
      cleanInitialListeners();
      resolve(new WebSocketClient(ws));
    };
    const errorListener = ({ message }: { message: string }) => {
      cleanInitialListeners();
      reject(new Error(message));
    };
    const closeListener = () => {
      cleanInitialListeners();
      reject(new Error("Connection closed before it was opened"));
    };

    const cleanInitialListeners = () => {
      ws.removeEventListener("open", openListener);
      ws.removeEventListener("error", errorListener);
      ws.removeEventListener("close", closeListener);
    };

    ws.addEventListener("open", openListener);
    ws.addEventListener("error", errorListener);
    ws.addEventListener("close", closeListener);
  });
