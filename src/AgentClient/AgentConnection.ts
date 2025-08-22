import {
  PitcherResponseStatus,
  isNotificationPayload,
  isErrorPayload,
  isResultPayload,
  decodeMessage,
  version,
} from "../pitcher-protocol";
import type {
  PitcherNotification,
  PitcherRequest,
  PitcherResponse,
} from "../pitcher-protocol";

import { PendingPitcherMessage } from "./PendingPitcherMessage";
import { createWebSocketClient, WebSocketClient } from "./WebSocketClient";
import { IAgentClientState } from "./agent-client-interface";
import { DEFAULT_SUBSCRIPTIONS } from "../types";
import { Emitter } from "../utils/event";
import { SliceList } from "../utils/sliceList";

export interface IRequestOptions {
  /**
   * The timeout for when to dispose the message when no response received
   */
  timeoutMs?: number;
}

/**
 * This class is completely decoupled from the connection itself. Pitcher class is responsible for funneling the messages
 * through the current connection. The connection can change when seamless branching or reconnecting.
 */
export class AgentConnection {
  static async create(url: string) {
    const ws = await createWebSocketClient(url);

    return new AgentConnection(ws, url);
  }

  private _state: IAgentClientState = "CONNECTED";
  private _isDisposed = false;

  get state() {
    return this._state;
  }
  set state(state: IAgentClientState) {
    this._state = state;
    this.onStateChangeEmitter.fire(state);

    if (state === "DISCONNECTED" || state === "HIBERNATED") {
      this.connection.dispose();
    }
  }

  private onStateChangeEmitter = new Emitter<IAgentClientState>();
  onStateChange = this.onStateChangeEmitter.event;

  private nextMessageId = 0;
  private pendingMessages = new Map<number, PendingPitcherMessage<any, any>>();
  private notificationListeners: Record<
    string,
    SliceList<(params: any) => void>
  > = {};

  private messageEmitter: Emitter<PitcherResponse | PitcherNotification> =
    new Emitter();
  onMessage = this.messageEmitter.event;

  private errorEmitter: Emitter<{
    message: string;
    extras: {
      source: string;
      type: string;
      request: PitcherRequest;
    };
  }> = new Emitter();
  onError = this.errorEmitter.event;

  constructor(public connection: WebSocketClient, private url: string) {
    this.subscribeConnection(connection);

    this.onNotification("system/hibernate", () => {
      this.state = "HIBERNATED";
    });
  }

  private subscribeConnection(connection: WebSocketClient) {
    connection.onMessage((message) => {
      this.receiveMessage(message);
    });

    connection.onDisconnected(() => {
      this.state = "DISCONNECTED";
    });

    connection.onMissingHeartbeat(() => {
      // Be more conservative about disconnection - only disconnect if we have no activity
      // and no pending messages, indicating a truly dead connection
      if (this.pendingMessages.size === 0) {
        // Add a small delay to allow for network recovery before declaring disconnection
        setTimeout(() => {
          if (this.pendingMessages.size === 0 && this.state === "CONNECTED") {
            this.state = "DISCONNECTED";
          }
        }, 1000);
      }
    });
  }

  onNotification<T extends PitcherNotification["method"]>(
    method: T,
    cb: (params: (PitcherNotification & { method: T })["params"]) => void
  ): () => void {
    let listeners = this.notificationListeners[method];
    if (!listeners) {
      listeners = this.notificationListeners[method] = new SliceList();
    }

    const idx = listeners.add(cb as any);
    return () => {
      this.notificationListeners[method]?.remove(idx);
    };
  }

  private receiveMessage(blob: Uint8Array): void {
    const payload = decodeMessage(blob);
    this.messageEmitter.fire(payload);

    const method = payload.method as
      | PitcherResponse["method"]
      | PitcherNotification["method"];

    if (isNotificationPayload(payload)) {
      const listeners = this.notificationListeners[method];
      if (listeners) {
        for (const cb of listeners.values()) {
          cb(payload.params);
        }
      }
      return;
    }

    let response: PitcherResponse;
    if (isErrorPayload(payload)) {
      response = {
        status: PitcherResponseStatus.REJECTED,
        error: {
          code: payload.error.code,
          data: payload.error.data,
          message: payload.error.message,
        },
        method,
      } as PitcherResponse;
    } else if (isResultPayload(payload)) {
      response = {
        status: PitcherResponseStatus.RESOLVED,
        result: payload.result,
        method,
      } as PitcherResponse;
    } else {
      throw new Error("Unable to identify message type");
    }

    const messageToResolve = this.pendingMessages.get(payload.id);

    if (messageToResolve) {
      messageToResolve.resolve(response);
    }

    // We do not care if we do not have a matching message, this is related to changing connection
  }
  request<T extends PitcherRequest>(
    pitcherRequest: T,
    options: IRequestOptions = {}
  ) {
    if (this._isDisposed) {
      throw new Error("Cannot perform operation: SandboxClient has been disposed");
    }
    
    const { timeoutMs } = options;
    const request = this.createRequest(pitcherRequest, timeoutMs);

    try {
      // This will throw if we are not in the right connection state
      this.connection.send(request.message);

      return request.unwrap();
    } catch (error) {
      this.errorEmitter.fire({
        message: (error as Error).message,
        extras: {
          source: "pitcher-message-handler",
          type: "send-request",
          request: pitcherRequest,
        },
      });

      // We always want to return a promise from the method so it does not matter if the error is related to disconnect
      // or Pitcher giving an error. It all ends up in the `catch` of the unwrapped promise
      return Promise.reject(error);
    }
  }

  private createRequest<T extends PitcherRequest>(
    request: T,
    timeoutMs?: number
  ): PendingPitcherMessage<T, PitcherResponse> {
    const id = this.nextMessageId++;
    const pitcherMessage = new PendingPitcherMessage(id, request, timeoutMs);

    this.pendingMessages.set(id, pitcherMessage);
    pitcherMessage.onDidDispose(() => this.pendingMessages.delete(id));

    return pitcherMessage;
  }

  private disposePendingMessages() {
    this.pendingMessages.forEach((pendingMessage) => {
      pendingMessage.dispose();
    });
  }

  async disconnect() {
    if (this.pendingMessages.size) {
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (this.pendingMessages.size) {
            return;
          }

          clearInterval(interval);
          resolve();
        }, 50);
      });
    }

    this.state = "DISCONNECTED";
  }

  async reconnect(reconnectToken: string, startVm: () => Promise<string>) {
    if (!(this.state === "DISCONNECTED" || this.state === "HIBERNATED")) {
      return;
    }

    this.state = "CONNECTING";
    this.connection.dispose();
    const url = new URL(this.url);

    const token = await startVm();

    url.searchParams.set("token", token);
    url.searchParams.set("reconnectToken", reconnectToken);

    this.connection = await createWebSocketClient(url.toString());
    this.subscribeConnection(this.connection);

    await this.request({
      method: "client/join",
      params: {
        clientInfo: {
          protocolVersion: version,
          appId: "sdk",
        },
        asyncProgress: false,
        subscriptions: DEFAULT_SUBSCRIPTIONS,
      },
    });

    this.state = "CONNECTED";
  }

  dispose(): void {
    this._isDisposed = true;
    this.errorEmitter.dispose();
    this.messageEmitter.dispose();
    this.connection.dispose();
    this.disposePendingMessages();
    this.pendingMessages.clear();
    this.notificationListeners = {};
  }
}
