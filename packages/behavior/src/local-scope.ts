import type { BehaviorValue } from "./expr.js";

export class LocalScopeStack {
  private readonly scopes: Map<string, BehaviorValue>[] = [new Map()];

  push(): void {
    this.scopes.push(new Map());
  }

  pop(): void {
    if (this.scopes.length === 1) {
      throw new Error("Cannot pop the root local scope");
    }
    this.scopes.pop();
  }

  declare(name: string, value: BehaviorValue): void {
    this.scopes[this.scopes.length - 1]?.set(name, value);
  }

  set(name: string, value: BehaviorValue): boolean {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const scope = this.scopes[index];
      if (scope?.has(name)) {
        scope.set(name, value);
        return true;
      }
    }
    return false;
  }

  get(name: string): BehaviorValue | undefined {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const value = this.scopes[index]?.get(name);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  snapshot(): ReadonlyMap<string, BehaviorValue> {
    const values = new Map<string, BehaviorValue>();
    for (const scope of this.scopes) {
      for (const [name, value] of scope) {
        values.set(name, value);
      }
    }
    return values;
  }
}
