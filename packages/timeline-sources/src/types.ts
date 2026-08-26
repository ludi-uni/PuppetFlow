import type { TimelineEvent } from "@puppetflow/core";

export interface TimelineSourceOptions {
  readonly offsetMs?: number;
}

export interface TimelineSource<Input = unknown> {
  readonly id: string;
  parse(input: Input, options?: TimelineSourceOptions): readonly TimelineEvent[];
}
