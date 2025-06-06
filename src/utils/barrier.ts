import { IDisposable } from "./disposable";

/**
 * The response from a barrier. If the barrier is disposed, the status is "disposed".
 * If the barrier is opened, the status is "resolved" and the value is the value passed to open().
 * This is used instead of rejecting a barrier promise so that error state is explicitly handled.
 */
export type BarrierResponse<T> =
  | {
      status: "disposed";
    }
  | {
      status: "resolved";
      value: T;
    };

/**
 * A barrier that is initially closed and then becomes opened permanently.
 * You can wait for the barrier to open, but you cannot close it again.
 */
export class Barrier<T> implements IDisposable {
  protected _isOpen: boolean;
  protected _promise: Promise<BarrierResponse<T>>;
  protected _completePromise!: (v: BarrierResponse<T>) => void;

  constructor() {
    this._isOpen = false;
    this._promise = new Promise<BarrierResponse<T>>((resolve) => {
      this._completePromise = resolve;
    });
  }

  /**
   * Returns true if the barrier is open, false if it is closed
   * @returns true if the barrier is open, false if it is closed
   */
  isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Opens the barrier. If the barrier is already open, this method does nothing.
   * @param value the value to return when the barrier is opened
   * @returns
   */
  open(value: T): void {
    if (this._isOpen) {
      return;
    }

    this._isOpen = true;
    this._completePromise({ status: "resolved", value });
  }

  /**
   *
   * @returns a promise that resolves when the barrier is opened. If the barrier is already open, the promise resolves immediately.
   */
  wait(): Promise<BarrierResponse<T>> {
    return this._promise;
  }

  /**
   * DO NOT USE THIS METHOD in production code. This is only for tests.
   * This is a convenience method that waits for the barrier to open and then returns the value.
   * If the Barrier is disposed while waiting to open, an error is thrown.
   * @returns the value if the barrier is open, otherwise throws an error
   */
  async __waitAndThrowIfDisposed(): Promise<T> {
    const r = await this.wait();
    if (r.status === "disposed") {
      throw new Error("Barrier was disposed");
    }
    return r.value;
  }

  /**
   * Disposes the barrier.
   * If there is a promise waiting for the barrier to open, it will be resolved with a status of "disposed".
   */
  dispose(): void {
    this._completePromise({ status: "disposed" });
  }
}

/**
 * Like Barrier, but you can close the barrier again
 */
export class ClosableBarrier<T> extends Barrier<T> {
  close(): void {
    this._isOpen = false;
    this._promise = new Promise<BarrierResponse<T>>((resolve) => {
      this._completePromise = resolve;
    });
  }
}
