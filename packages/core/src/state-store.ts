export type StateValue = number | string | boolean;

export class StateStore {
  private readonly values = new Map<string, StateValue>();

  get(key: string): StateValue | undefined {
    return this.values.get(key);
  }

  set(key: string, value: StateValue): void {
    this.values.set(key, value);
  }

  getAll(): Record<string, StateValue> {
    return Object.fromEntries(this.values.entries());
  }

  delete(key: string): boolean {
    return this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}
