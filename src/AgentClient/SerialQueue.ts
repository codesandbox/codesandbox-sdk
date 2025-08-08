export type PromiseCallback<T> = () => Promise<T>;

export type QueueCallback<T> = PromiseCallback<T> | (() => T);

interface QueueItem {
  key?: string;
  callback: QueueCallback<any>;
  resolves: ((val: any) => void)[];
  rejects: ((err: any) => void)[];
}

/**
 * SerialQueue runs 1 promise at a time, very useful for reducing load and working around lock files
 */
export class SerialQueue {
  private items: QueueItem[] = [];
  private isProcessing = false;

  constructor(private name: string, private debug: boolean = false) {}

  private async processQueue() {
    if (this.isProcessing) return;

    const item = this.items.shift();
    if (item) {
      if (this.debug) {
        console.log(`Running queue item ${this.name}#${item.key ?? "unknown"}`);
      }

      this.isProcessing = true;
      try {
        const result = await item.callback();
        for (const resolve of item.resolves) {
          try {
            resolve(result);
          } catch (err) {
            // do nothing
          }
        }
      } catch (err) {
        for (const reject of item.rejects) {
          try {
            reject(err);
          } catch (err) {
            // do nothing
          }
        }
      }
      this.isProcessing = false;

      if (this.debug) {
        console.log(
          `Processed queue item ${this.name}#${item.key ?? "unknown"}`
        );
      }

      // Process next item
      this.processQueue();
    }
  }

  /**
   * Add a new promise callback to the queue
   *
   * in case you provide a key it will be used to de-duplicate against existing items in the queue
   * if there is an existing item, the callback of that item will be used and this function will
   * return the result of that callback instead
   */
  add<T>(callback: QueueCallback<T>, key?: string): Promise<T> {
    if (this.debug) {
      console.log(`Adding item ${this.name}#${key ?? "unknown"} to the queue`);
    }

    return new Promise((resolve, reject) => {
      let shouldAdd = true;
      let item: QueueItem = {
        key,
        callback,
        resolves: [],
        rejects: [],
      };

      if (key) {
        const foundItem = this.items.find((i) => i.key === key);
        if (foundItem) {
          item = foundItem;
          shouldAdd = false;
        }
      }

      item.resolves.push(resolve);
      item.rejects.push(reject);

      if (shouldAdd) {
        this.items.push(item);
      }

      this.processQueue().catch(console.error);
    });
  }
}
