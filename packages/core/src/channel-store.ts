import type { ChannelValue } from "./channel.js";

export type ChannelListener = (key: string, value: ChannelValue | undefined) => void;

export class ChannelStore {
  private readonly values = new Map<string, ChannelValue>();
  private readonly listeners = new Set<ChannelListener>();

  get(key: string): ChannelValue | undefined {
    return this.values.get(key);
  }

  set(key: string, value: ChannelValue): void {
    this.values.set(key, value);
    this.notify(key, value);
  }

  getAll(): Record<string, ChannelValue> {
    return Object.fromEntries(this.values.entries());
  }

  delete(key: string): boolean {
    const removed = this.values.delete(key);
    if (removed) {
      this.notify(key, undefined);
    }
    return removed;
  }

  clear(): void {
    const keys = [...this.values.keys()];
    this.values.clear();
    for (const key of keys) {
      this.notify(key, undefined);
    }
  }

  subscribe(listener: ChannelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(key: string, value: ChannelValue | undefined): void {
    for (const listener of this.listeners) {
      listener(key, value);
    }
  }
}
