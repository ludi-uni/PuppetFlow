import { ChannelStore, type ChannelValue } from "@puppetflow/core";

export class RuntimeChannelStore extends ChannelStore {
  constructor(private readonly onChange: () => void) {
    super();
  }

  override set(key: string, value: ChannelValue): void {
    super.set(key, value);
    this.onChange();
  }

  override delete(key: string): boolean {
    const removed = super.delete(key);
    if (removed) {
      this.onChange();
    }
    return removed;
  }

  override clear(): void {
    if (Object.keys(this.getAll()).length === 0) {
      return;
    }
    super.clear();
    this.onChange();
  }
}
