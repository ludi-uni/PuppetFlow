import type {
  ActRequest,
  ClearExpressionRequest,
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControlState,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";
import {
  PuppetFlowControlClient,
  type PuppetFlowControlClientOptions,
} from "@puppetflow/control-client";
import type { McpControlClient } from "./control.js";

export interface SharedControlEnvironment {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export class SharedHostMcpControl implements McpControlClient {
  private constructor(
    private readonly client: PuppetFlowControlClient,
    private capabilities: PuppetFlowCapabilities,
  ) {}

  static async connect(
    options: PuppetFlowControlClientOptions,
  ): Promise<SharedHostMcpControl> {
    const client = new PuppetFlowControlClient(options);
    const connected = await client.connect();
    return new SharedHostMcpControl(client, connected.capabilities);
  }

  act(request: ActRequest): Promise<ControlResult> {
    return this.command(() => this.client.act(request));
  }
  sequence(request: SequenceRequest): Promise<ControlResult> {
    return this.command(() => this.client.sequence(request));
  }
  interrupt(): Promise<ControlResult> {
    return this.command(() => this.client.interrupt());
  }
  setExpression(request: SetExpressionRequest): Promise<ControlResult> {
    return this.command(() => this.client.setExpression(request));
  }
  clearExpression(request: ClearExpressionRequest = {}): Promise<ControlResult> {
    return this.command(() => this.client.clearExpression(request));
  }
  async getState(): Promise<PuppetFlowControlState> {
    try {
      return (await this.client.getSnapshot()).state;
    } catch {
      const connected = await this.client.connect();
      this.capabilities = connected.capabilities;
      return connected.snapshot.state;
    }
  }
  async getCapabilities(): Promise<PuppetFlowCapabilities> {
    return this.capabilities;
  }
  close(): void {
    this.client.close();
  }

  private async command(
    operation: () => Promise<ControlResult>,
  ): Promise<ControlResult> {
    try {
      return await operation();
    } catch (error) {
      await this.client.connect().then(
        (connected) => {
          this.capabilities = connected.capabilities;
        },
        () => undefined,
      );
      throw error;
    }
  }
}

export function resolveSharedControlEnvironment(
  environment: NodeJS.ProcessEnv,
): SharedControlEnvironment {
  const baseUrl = environment.PUPPETFLOW_SHARED_HOST_URL?.trim();
  const token = environment.PUPPETFLOW_SHARED_HOST_TOKEN?.trim();
  if (!baseUrl || !token) {
    throw new Error(
      "PUPPETFLOW_SHARED_HOST_URL and PUPPETFLOW_SHARED_HOST_TOKEN are required",
    );
  }
  const rawTimeout = environment.PUPPETFLOW_SHARED_HOST_TIMEOUT_MS?.trim();
  const timeoutMs =
    rawTimeout === undefined || rawTimeout === "" ? 5_000 : Number(rawTimeout);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("PUPPETFLOW_SHARED_HOST_TIMEOUT_MS must be a positive number");
  }
  return { baseUrl, token, timeoutMs };
}
