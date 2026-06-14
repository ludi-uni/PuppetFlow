export interface FrameContext {
  deltaTime: number;
  frameNumber: number;
  elapsedTime: number;
}

export type StatefulValue = number | boolean;

export interface StatefulUpdateResult<TState = unknown> {
  value: StatefulValue;
  state: TState;
}

export interface StatefulFunctionDefinition<TState = unknown> {
  name: string;
  createState(config: Record<string, number | string>): TState;
  update(
    frame: FrameContext,
    state: TState,
    config: Record<string, number | string>,
    input: number,
  ): StatefulUpdateResult<TState>;
}

export interface StatefulRegistry {
  register(def: StatefulFunctionDefinition): void;
  get(name: string): StatefulFunctionDefinition | undefined;
  names(): string[];
}

export interface StatefulEntrySnapshot {
  functionName: string;
  instanceId: string;
  lastValue: StatefulValue;
  state: unknown;
}
