import type {
  FrameContext,
  StatefulEntrySnapshot,
  StatefulFunctionDefinition,
  StatefulRegistry,
  StatefulValue,
} from "./types.js";

interface StatefulEntry {
  defName: string;
  instanceId: string;
  state: unknown;
  lastValue: StatefulValue;
}

function entryKey(functionName: string, instanceId: string): string {
  return `${functionName}:${instanceId}`;
}

export class StatefulStore {
  private readonly entries = new Map<string, StatefulEntry>();

  reset(): void {
    this.entries.clear();
  }

  peek(functionName: string, instanceId: string): unknown {
    return this.entries.get(entryKey(functionName, instanceId))?.state;
  }

  snapshot(): StatefulEntrySnapshot[] {
    return [...this.entries.values()]
      .map((entry) => ({
        functionName: entry.defName,
        instanceId: entry.instanceId,
        lastValue: entry.lastValue,
        state: entry.state,
      }))
      .sort((a, b) => {
        const byFunction = a.functionName.localeCompare(b.functionName);
        return byFunction !== 0 ? byFunction : a.instanceId.localeCompare(b.instanceId);
      });
  }

  evaluate(
    functionName: string,
    instanceId: string,
    config: Record<string, number | string>,
    input: number,
    frame: FrameContext,
    registry: StatefulRegistry,
  ): StatefulValue {
    const def = registry.get(functionName) as StatefulFunctionDefinition | undefined;
    if (!def) {
      return 0;
    }

    const key = entryKey(functionName, instanceId);
    const existing = this.entries.get(key);
    const state =
      existing?.defName === functionName
        ? existing.state
        : def.createState(config);

    const result = def.update(frame, state, { ...config, __instanceId: instanceId }, input);
    this.entries.set(key, {
      defName: functionName,
      instanceId,
      state: result.state,
      lastValue: result.value,
    });
    return result.value;
  }
}
