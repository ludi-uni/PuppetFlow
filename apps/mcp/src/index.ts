export type {
  McpControlClient,
  NormalizedActingState,
  NormalizedExpressionState,
} from "./control.js";
export { normalizeState } from "./control.js";
export { type BridgeErrorCode, BridgeError } from "./errors.js";
export { startFromEnvironment } from "./main.js";
export { buildServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
export {
  resolveSharedControlEnvironment,
  SharedHostMcpControl,
} from "./shared-control-client.js";
export { registerTools } from "./tools.js";
