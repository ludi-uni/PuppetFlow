import { StateStore } from "@puppetflow/core";

export class RuntimeStateStore extends StateStore {
  constructor(private readonly onChange: () => void) {
    super();
  }

  override set(key: string, value: number | string | boolean): void {
    super.set(key, value);
    this.onChange();
  }
}
