/* eslint-disable @typescript-eslint/no-explicit-any */
import { Disposable } from "@codesandbox/pitcher-common";
import {
  PitcherResponseStatus,
  createRequestPayload,
} from "@codesandbox/pitcher-protocol";
import type {
  PitcherRequest,
  PitcherResponse,
  PitcherRequestPayload,
  PitcherErrorCode,
} from "@codesandbox/pitcher-protocol";

const PITCHER_MESSAGE_TIMEOUT_MS = 90_000;

export class PitcherMessageError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }

  static match(error: any): error is PitcherMessageError {
    return error instanceof PitcherMessageError;
  }

  static matchCode(
    error: any,
    code: PitcherErrorCode
  ): error is PitcherMessageError {
    return error instanceof PitcherMessageError && error.code === code;
  }
}

export class PendingPitcherMessage<
  T extends PitcherRequest,
  R extends PitcherResponse = PitcherResponse
> extends Disposable {
  id: number;
  message: Uint8Array;
  promise: Promise<R extends { method: T["method"] } ? R : never>;
  method: PitcherRequest["method"];

  private timeoutRef?: NodeJS.Timeout;
  private _hasResolved = false;
  private _resolve?: (res: any) => void;
  private _reject?: (err: Error) => void;

  constructor(
    id: number,
    request: T,
    timeoutMs: number = PITCHER_MESSAGE_TIMEOUT_MS
  ) {
    super();

    this.id = id;
    const data: unknown = {
      ...request,
      id,
    };
    this.method = request.method;
    this.message = createRequestPayload(data as PitcherRequestPayload);
    this.timeoutRef = setTimeout(
      () => this.dispose(`Pitcher message ${this.method} timed out`),
      timeoutMs
    );
    this.onWillDispose(() => {
      if (this.timeoutRef) {
        clearTimeout(this.timeoutRef);
        this.timeoutRef = undefined;
      }
    });
    this.promise = new Promise<R extends { method: T["method"] } ? R : never>(
      (_resolve, _reject) => {
        this._resolve = _resolve;
        this._reject = _reject;
      }
    ).then((response) => {
      if (response.status === PitcherResponseStatus.RESOLVED) {
        return response.result;
      }

      const err = new PitcherMessageError(
        response.error.message,
        response.error.code
      );
      // @ts-expect-error - data is optional
      err.data = response.error.data;

      throw err;
    }) as any;
  }

  resolve(response: R extends { method: T["method"] } ? R : never): void {
    if (!this.isDisposed && this._resolve) {
      this._resolve(response);
      this._hasResolved = true;
    }
    this.dispose();
  }

  reject(error: Error): void {
    if (!this.isDisposed && this._reject) {
      this._reject(error);
      this._hasResolved = true;
    }
    this.dispose();
  }

  unwrap(): R extends {
    method: T["method"];
    status: PitcherResponseStatus.RESOLVED;
  }
    ? Promise<R["result"]>
    : never {
    return this.promise as any;
  }

  dispose(message?: string) {
    if (!this._hasResolved && this._reject) {
      this._reject(
        new Error(message ?? `Pitcher message ${this.method} has been disposed`)
      );
    }

    super.dispose();

    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = undefined;
    }
  }
}
