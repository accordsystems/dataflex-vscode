# Feature 200 — Workspace Symbol Index

**Status:** In Progress — `buildSymbolIndex` complete and tested; `WorkspaceIndex` next

## Goal

Build and maintain an in-memory index of all DataFlex symbols across the entire workspace — not just open documents. This is the shared data layer that Go to Definition (100), Workspace Symbol Search (210), Find All References (300), and Completion (400) all depend on.

## Background

Today, `SymbolIndexBuilder.indexDocument()` is called per open document via `onDidChangeContent`. It builds scope hierarchies correctly but `buildSymbolIndex` is a stub that returns an empty array. `DefinitionFinder` maintains its own `Map<string, SymbolDefinition[]>` instance, populated only from open documents via `updateDocument()`.

This feature:
1. Implements `buildSymbolIndex` to extract the five priority symbol types.
2. Creates a `WorkspaceIndex` singleton that all server features query.
3. Wires a background workspace scan after the resolver runs.
4. Refactors `DefinitionFinder` to query `WorkspaceIndex` instead of its own map.

## Symbol Types (Phase 1)

| DataFlex construct | `DataFlexSymbolType` key | Regex trigger |
|--------------------|--------------------------|---------------|
| `Procedure foo` | `procedure` | `^Procedure\s+(\w+)` |
| `Function foo` | `function` | `^Function\s+(\w+)` |
| `Class foo is a bar` | `class` | `^Class\s+(\w+)` |
| `Object foo is a bar` | `object` | `^Object\s+(\w+)` |
| `#DEFINE FOO value` | `define` | `^#DEFINE\s+(\w+)` |

Variables (String, Integer, etc.) are excluded from phase 1 — too numerous and context-sensitive for useful cross-file navigation.

## Data Model

### `WorkspaceIndex` (new singleton)

```typescript
// server/src/Symbols/WorkspaceIndex.ts

export class WorkspaceIndex {
    private static _instance: WorkspaceIndex;
    static get instance(): WorkspaceIndex { ... }

    // Map of lowercase symbol name → all matching definitions across workspace
    private byName: Map<string, SymbolDefinition[]> = new Map();

    // Map of file absolute path (lowercase) → symbols defined in that file
    private byFile: Map<string, SymbolDefinition[]> = new Map();

    // True once the initial workspace scan completes
    isReady: boolean = false;

    /** Index all symbols in a single file. Safe to call on save. */
    indexFile(filePath: string): void { ... }

    /** Background scan: enumerate files from resolver paths, call indexFile for each. */
    async indexWorkspace(appSrcPaths: string[], ddSrcPaths: string[]): Promise<void> { ... }

    /** Remove all symbols contributed by a file (call before re-indexing it). */
    clearFile(filePath: string): void { ... }

    /** Full reset — used when the .sws setting changes. */
    clear(): void { ... }

    /** Find all definitions of a symbol by name (case-insensitive). */
    findByName(name: string): SymbolDefinition[] { ... }

    /** All symbols defined in a given file. */
    findByFile(filePath: string): SymbolDefinition[] { ... }
}
```

### File enumeration order

Files are enumerated from `DataflexWorkspaceResolver.getAppSrcPaths()` and `getDdSrcPaths()` in resolver order (main workspace first, then libraries depth-first). Within each directory, files are scanned in filesystem order. The search order from the resolver ensures that shadowed files (same name appearing in both a main workspace dir and a library dir) are indexed, with the main workspace copy appearing first — matching compiler precedence.

Extensions scanned: `.src`, `.pkg`, `.wo`, `.inc`, `.dd`

## Algorithm

### `buildSymbolIndex` (in `SymbolIndexBuilder`)

For each line, test against the five phase-1 regexes (case-insensitive). On match:
- `name` = captured group 1
- `type` = corresponding `DataFlexSymbolType`
- `location` = `{ uri: documentUri, range: { start: { line, character: 0 }, end: { line, character: line.length } } }`
- `scope` = the innermost scope from the already-built scope hierarchy that contains this line
- `visibility` = `'public'` for now (visibility inference is a future concern)

### `WorkspaceIndex.indexFile`

1. Read file from disk (`fs.readFileSync`, encoding `latin1` — CP437 identifiers are ASCII-safe with latin1).
2. Wrap as a `TextDocument` using `TextDocument.create(uri, 'dataflex', 0, content)`.
3. Call `SymbolIndexBuilder.indexDocument(doc)` to get `{ symbols, scopes }`.
4. Store symbols in `byName` and `byFile`.

### `WorkspaceIndex.indexWorkspace`

1. Collect all file paths from `appSrcPaths` + `ddSrcPaths` using `fs.readdirSync` filtered by extension.
2. Deduplicate by lowercase absolute path (same shadowing logic as the resolver).
3. Iterate with `for...of` — `await new Promise(resolve => setImmediate(resolve))` every 50 files to yield to the event loop and keep the server responsive.
4. Set `isReady = true` when complete, log count to `connection.console`.

### `DefinitionFinder` refactor

- Remove `private symbolIndex` and `private documentScopes` instance maps.
- `updateDocument` → delegates to `WorkspaceIndex.instance.indexFile(uri)`.
- `findDefinitions` → queries `WorkspaceIndex.instance.findByName(symbol)`, then applies the existing scope/visibility filter.

### `server.ts` wiring

After `resolveWorkspace()` succeeds, trigger the background scan:
```typescript
const paths = DataflexWorkspaceResolver.getAppSrcPaths(resolvedWorkspace);
const ddPaths = DataflexWorkspaceResolver.getDdSrcPaths(resolvedWorkspace);
WorkspaceIndex.instance.indexWorkspace(paths, ddPaths)
    .catch(e => connection.console.warn(`[WorkspaceIndex] ${e.message}`));
```

On `onDidSave` (or `onDidChangeContent`): call `WorkspaceIndex.instance.indexFile(uri)` after `validateTextDocument`.

On SWS change (`resolveWorkspace` re-runs): call `WorkspaceIndex.instance.clear()` first, then trigger a new background scan.

## Files Involved

- [server/src/Symbols/WorkspaceIndex.ts](../../server/src/Symbols/WorkspaceIndex.ts) — **new** singleton
- [server/src/Symbols/SymbolIndexBuilder.ts](../../server/src/Symbols/SymbolIndexBuilder.ts) — implement `buildSymbolIndex` stub
- [server/src/Definitions/DefinitionFinder.ts](../../server/src/Definitions/DefinitionFinder.ts) — refactor to query `WorkspaceIndex`
- [server/src/server.ts](../../server/src/server.ts) — trigger background scan; clear on SWS change

## Related Features

- [190 — Workspace Resolver](./190-workspace-resolver.md) — provides the ordered `appSrcPaths` / `ddSrcPaths` lists (**done**)
- [100 — Go to Definition](./100-gotodefinition.md) — cross-file definitions become possible once 200 is done
- 210 — Workspace Symbol Search — queries `WorkspaceIndex.findByName`
- 300 — Find All References — queries `WorkspaceIndex.findByFile` + `findByName`
- 400 — Completion — queries `WorkspaceIndex.findByName` for candidate completions

## TODO

Format: `[ ]` open / `[x]` done. Each line is `[state] YYYY-MM-DD — description` and a done line appends `(done YYYY-MM-DD)`.

- [x] 2026-05-22 — Implement `buildSymbolIndex` in `SymbolIndexBuilder` — extract Procedure, Function, Class, Object, Define with line/location (done 2026-05-25)
- [x] 2026-05-22 — Unit tests for `buildSymbolIndex` — each symbol type, case-insensitive match, scope attribution (done 2026-05-25)
- [ ] 2026-05-25 — Create `WorkspaceIndex` singleton with `indexFile`, `indexWorkspace`, `clearFile`, `clear`, `findByName`, `findByFile`
- [ ] 2026-05-25 — Unit tests for `WorkspaceIndex` — indexFile adds symbols, clearFile removes them, findByName is case-insensitive, shadowed file (same symbol in two files) returns both
- [ ] 2026-05-25 — Wire `server.ts` to trigger background `indexWorkspace` after `resolveWorkspace` succeeds
- [ ] 2026-05-25 — Wire `server.ts` to call `WorkspaceIndex.instance.clear()` before re-resolving on SWS change
- [ ] 2026-05-25 — Refactor `DefinitionFinder` to query `WorkspaceIndex` instead of its own symbol map
- [ ] 2026-05-25 — Unit tests for refactored `DefinitionFinder` — cross-file definition found, open-doc symbol found, unknown symbol returns empty

## Decisions

| # | Date | Decision |
|---|------|----------|
| 1 | 2026-05-25 | Removed `documentUri` field from `SymbolDefinition` — redundant with `location.uri` (LSP `Location` already carries the URI). All call sites updated to use `symbol.location.uri`. |
| 2 | 2026-05-25 | Removed `createSymbolDefinition` factory helper — no-value wrapper with no defaults or validation; symbol objects are constructed inline in `buildSymbolIndex`. |
| 3 | 2026-05-25 | Fixed `getInnermostScope` scope attribution bug — when the innermost scope starts at the same line as the symbol being declared, the symbol belongs to the *parent* scope, not to the scope it creates. Fixed by returning `innermost.parentScope` when `innermost.startLine === lineNumber && innermost.parentScope !== null`. |
| 4 | 2026-05-25 | `indexWorkspace` open question — should it accept directories and enumerate files internally, or accept an already-enumerated file path list? Deferred to `WorkspaceIndex` implementation session. |
