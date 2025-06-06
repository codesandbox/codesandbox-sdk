export class SliceList<T> {
  private idx = 0;
  private store: Map<number, T> = new Map();

  /**
   * Add a value to the list
   *
   * @returns a unique reference to delete the item
   */
  add(value: T): number {
    const nextIdx = this.idx + 1;
    this.idx = nextIdx;
    this.store.set(nextIdx, value);
    return nextIdx;
  }

  /**
   * Remove a value using the unique reference
   */
  remove(idx: number): void {
    this.store.delete(idx);
  }

  /**
   * Get values as an iterator
   */
  values(): IterableIterator<T> {
    return this.store.values();
  }

  /**
   * Get values as an array
   */
  array(): Array<T> {
    return Array.from(this.store.values());
  }

  /**
   * Get amount of items in the list
   */
  size(): number {
    return this.store.size;
  }
}
