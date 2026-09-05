# PuppetFlow MCP

`@puppetflow/mcp` is the PuppetFlow v2 canonical stdio MCP application. It is a
client of an already-running loopback shared Host and never creates a
`PuppetFlowRuntime`, Host, VMC sender, or child process.

After `pnpm install --frozen-lockfile`, build the workspace application and
start the shared Host first. The MCP build script builds the workspace dependency
closure required by `@puppetflow/control-client` before compiling the entrypoint:

```powershell
pnpm --filter @puppetflow/mcp build
$env:PUPPETFLOW_CONTROL_TOKEN = "<runtime token>"
pnpm pf shared-host --preset Idle
```

Configure an MCP client to spawn the built entrypoint from the PuppetFlow
checkout. Supply the token through the client process environment, not through
the command line:

```json
{
  "command": "node",
  "args": ["D:/path/to/PuppetFlow/apps/mcp/dist/main.js"],
  "cwd": "D:/path/to/PuppetFlow",
  "env": {
    "PUPPETFLOW_SHARED_HOST_URL": "http://127.0.0.1:8788",
    "PUPPETFLOW_SHARED_HOST_TOKEN": "<runtime token>",
    "PUPPETFLOW_SHARED_HOST_TIMEOUT_MS": "5000"
  }
}
```

The seven compatibility tools remain `act`, `sequence`, `look_at`,
`interrupt`, `get_state`, `set_expression`, and `clear_expression`. Their MCP
schemas and normalized result/error forms were migrated from
`PuppetFlow_Acting_MCP` commit
`bb0ff6398d8e47ce7c1f69942f8bbbab26e29c9d`. Action and expression support is
decided by the shared Host's canonical Control; this app carries no motion
profile or capability registry.

The source repository is retained as the compatibility home for its former
`--host-module` and standalone Runtime-owning launch modes. Those modes are not
part of this workspace entrypoint. PuppetFlow is licensed under Apache-2.0;
the migrated source did not contain a separate license file.
