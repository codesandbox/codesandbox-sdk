/* eslint-disable @typescript-eslint/no-explicit-any */
import { Emitter, SliceList } from "@codesandbox/pitcher-common";
import {
  PitcherResponseStatus,
  isNotificationPayload,
  isErrorPayload,
  isResultPayload,
  decodeMessage,
} from "@codesandbox/pitcher-protocol";
import type {
  PitcherNotification,
  PitcherRequest,
  PitcherResponse,
} from "@codesandbox/pitcher-protocol";

import { PendingPitcherMessage } from "./PendingPitcherMessage";
import { createWebSocketClient, WebSocketClient } from "./WebSocketClient";

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
export class PitcherProtocol<
  Request extends PitcherRequest = PitcherRequest,
  Response extends PitcherResponse = PitcherResponse,
  Notification extends PitcherNotification = PitcherNotification
> {
  static async create(url: string) {
    const ws = await createWebSocketClient(url);

    return new PitcherProtocol(ws);
  }

  private nextMessageId = 0;
  private pendingMessages = new Map<number, PendingPitcherMessage<any, any>>();
  private notificationListeners: Record<
    string,
    SliceList<(params: any) => void>
  > = {};

  private messageEmitter: Emitter<Response | Notification> = new Emitter();
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

  constructor(private connection: WebSocketClient) {
    connection.onMessage((message) => {
      this.receiveMessage(message);
    });
  }

  onNotification<T extends Notification["method"]>(
    method: T,
    cb: (
      params: Notification extends { method: T }
        ? Notification["params"]
        : never
    ) => void
  ): () => void {
    let listeners = this.notificationListeners[method];
    if (!listeners) {
      listeners = this.notificationListeners[method] = new SliceList();
    }

    const idx = listeners.add(cb);
    return () => {
      this.notificationListeners[method]?.remove(idx);
    };
  }

  private receiveMessage(blob: Uint8Array): void {
    const payload = decodeMessage(blob);
    this.messageEmitter.fire(payload);

    const method = payload.method as
      | Response["method"]
      | Notification["method"];

    if (isNotificationPayload(payload)) {
      const listeners = this.notificationListeners[method];
      if (listeners) {
        for (const cb of listeners.values()) {
          cb(payload.params);
        }
      }
      return;
    }

    let response: Response;
    if (isErrorPayload(payload)) {
      response = {
        status: PitcherResponseStatus.REJECTED,
        error: {
          code: payload.error.code,
          data: payload.error.data,
          message: payload.error.message,
        },
        method,
      } as Response;
    } else if (isResultPayload(payload)) {
      response = {
        status: PitcherResponseStatus.RESOLVED,
        result: payload.result,
        method,
      } as Response;
    } else {
      throw new Error("Unable to identify message type");
    }

    const messageToResolve = this.pendingMessages.get(payload.id);

    if (messageToResolve) {
      messageToResolve.resolve(response);
    }

    // We do not care if we do not have a matching message, this is related to changing connection
  }
  request<T extends Request>(pitcherRequest: T, options: IRequestOptions = {}) {
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

  private createRequest<T extends Request>(
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

  dispose(): void {
    this.connection.dispose();
    this.disposePendingMessages();
    this.pendingMessages.clear();
    this.notificationListeners = {};
    this.errorEmitter.dispose();
    this.messageEmitter.dispose();
  }
}
