# Maintenance Log

Tracked tech-debt items and known oddities that aren't tied to a specific feature. Use this for things that should be revisited but don't need a dedicated feature file in [features/](./features/README.md).

## Format

Each item has its own `##` section. Inside:

- **Status:** Open / Deferred / Done
- **Added:** YYYY-MM-DD
- **Closed:** YYYY-MM-DD (when Done)
- **Files:** the source files or paths involved
- Body — what the issue is, why it matters, and the options for resolving it.

Don't delete closed items — they double as a history of decisions.

---

## 001 — `console.log` in server code is not routed to the LSP output channel under IPC transport

**Status:** Deferred
**Added:** 2026-05-14
**Files:** [server/src/workspace/DataflexWorkspaceResolver.ts](../server/src/workspace/DataflexWorkspaceResolver.ts) (lines 95, 116, 126, 129), [client/src/languageClient/dataflexLanguageClient.ts:20-24](../client/src/languageClient/dataflexLanguageClient.ts#L20-L24)

### Issue

The `vscode-languageserver` library has a `patchConsole(logger)` function in [server/node_modules/vscode-languageserver/lib/node/main.js](../server/node_modules/vscode-languageserver/lib/node/main.js) (lines 218–274) that swaps `console.log` / `debug` / `error` / `warn` / `assert` / `trace` / `count` to route through the LSP `window/logMessage` notification. Once patched, `console.log` output appears in the dedicated language-server Output channel in VSCode.

However, that patch is **only applied when the server starts with `--stdio` transport** (line 211–213 of the same library file). For any other transport (`--node-ipc`, `--socket`, `--pipe`), the patch is skipped — the rationale being that stdio transport uses stdout for the JSON-RPC stream and rogue `console.log` would corrupt it, but other transports use separate channels and don't need the protection.

Our client launches the server with `TransportKind.ipc`, so the patch never runs. Server-side `console.log` calls therefore go to the server process's raw stdout, which VSCode captures in a generic extension-host output channel rather than the dedicated language-server channel.

### Implications

- **Under unit tests** (mocha): modules are imported and called directly, no LSP layer involved. `console.log` lands in the test terminal as expected. This is why the calls have been visible during development.
- **At runtime inside VSCode**: output is not lost, but lands in a noisier generic output channel. Not the natural place a maintainer would look.

### Resolution options when revisited

1. **Delete the calls** — they were debug breadcrumbs from initial development; test coverage now provides the same verification.
2. **Switch to `TransportKind.stdio`** — the library's auto-patch then takes effect with zero code change. Slightly slower per-message but well within budget for our use case.
3. **Explicitly route through `connection.console.log(...)`** — requires plumbing the LSP connection into static helpers like `parseIni`, e.g. via a module-level logger injected at server start.

### Why deferred

Not a correctness issue. The logs work fine under tests (the primary current consumer) and the runtime case isn't broken, just sub-optimally surfaced. Revisit when either (a) the logs become noisy in tests, or (b) someone needs to debug a runtime issue and notices the logs aren't where they expect.

---

## 002 — `dataflex.workspace.swsFile` should be selectable from the VS Code status bar

**Status:** Open
**Added:** 2026-05-22
**Files:** [client/src/extension.ts](../client/src/extension.ts), [package.json](../package.json)

### Issue

`dataflex.workspace.swsFile` is currently a plain string setting that must be typed manually in Settings UI or `settings.json`. For workspaces that contain multiple `.sws` files (e.g. `cI20 - x64 Compile.sws` alongside `cAcm - x64 Compile.sws`) this is cumbersome to switch.

The desired UX is a status bar item (bottom-right, similar to the language mode or branch picker) that shows the basename of the active `.sws` file and opens a Quick Pick when clicked, letting the user select from `.sws` files discovered in the current workspace folders.

### Implementation sketch

1. In `extension.ts`, create a `vscode.StatusBarItem` (alignment `Right`, priority low).
2. Populate the Quick Pick by running `vscode.workspace.findFiles('**/*.sws', null, 20)`.
3. On selection, write the chosen path back to `vscode.workspace.getConfiguration('dataflex').update('workspace.swsFile', ...)`.
4. Listen to `vscode.workspace.onDidChangeConfiguration` to refresh the status bar label whenever the setting changes externally.
5. Dispose the item in the extension's `deactivate`.

### Why deferred

Manual entry is sufficient for current single-workspace usage. Implement when switching between `.sws` files becomes a frequent workflow.
