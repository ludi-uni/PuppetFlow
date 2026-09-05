import { McpServer } from "@modelcontextprotocol/server";
import type { McpControlClient } from "./control.js";
import { registerTools } from "./tools.js";

export const SERVER_NAME = "puppetflow-acting-mcp";
export const SERVER_VERSION = "0.1.0";

export function buildServer(control: McpControlClient): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server, control);
  return server;
}
