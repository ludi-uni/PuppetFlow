import { applyInputPayload } from "@puppetflow/source-core";
import type { SourceUpdateTarget, StateSource } from "@puppetflow/source-core";
import { Client, GatewayIntentBits, type Message } from "discord.js";

export interface DiscordSourceConfig {
  token: string;
  channelId: string;
  fieldMapping?: Record<string, string>;
}

function extractPayload(message: Message): unknown | null {
  const content = message.content.trim();
  if (!content.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

export class DiscordSource implements StateSource {
  readonly id = "discord";

  private readonly token: string;
  private readonly channelId: string;
  private readonly fieldMapping: Record<string, string>;
  private client: Client | null = null;
  private pendingPayload: unknown = null;

  constructor(config: DiscordSourceConfig) {
    this.token = config.token;
    this.channelId = config.channelId;
    this.fieldMapping = config.fieldMapping ?? {};
  }

  async initialize(): Promise<void> {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    await new Promise<void>((resolve, reject) => {
      client.once("ready", () => resolve());
      client.once("error", reject);
      void client.login(this.token);
    });

    client.on("messageCreate", (message) => {
      if (message.channelId !== this.channelId || message.author.bot) {
        return;
      }

      const payload = extractPayload(message);
      if (payload) {
        this.pendingPayload = payload;
      }
    });

    this.client = client;
  }

  async update(target: SourceUpdateTarget): Promise<void> {
    if (!this.pendingPayload) {
      return;
    }

    applyInputPayload(target, this.pendingPayload, this.fieldMapping);
    this.pendingPayload = null;
  }

  async dispose(): Promise<void> {
    this.client?.destroy();
    this.client = null;
  }
}
