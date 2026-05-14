# Feature 100 — Go to Definition

**Status:** In Progress
**LSP capability:** `textDocument/definition`

## Goal

Pressing F12 (or right-click → Go to Definition) on a symbol jumps to where that symbol is declared. Covers procedures, functions, classes, objects, types, and variables. Works within a single file first, then workspace-wide across `USE` / `#INCLUDE` boundaries.

## Design

End-to-end LSP flow:

1. Client sends `textDocument/definition` with cursor position.
2. Server resolves the word at the cursor.
3. Server looks up the word in its symbol index.
4. Server filters candidates by scope accessibility from the request position.
5. Server returns `Location[]`. VSCode shows the matching file/range, or a picker if multiple.

## Data Model

```typescript
interface SymbolDefinition {
    name: string;
    kind: DataFlexSymbolType;     // Procedure | Function | Variable | Class | Object | Type
    uri: string;
    range: Range;                 // full declaration
    selectionRange: Range;        // name only
    visibility: 'local' | 'global';
    scope: ScopeInfo;             // enclosing scope
}
```

## Symbols to Extract

| Pattern | Kind | Visibility |
|---------|------|-----------|
| `Procedure <name> …` | Procedure | global at file top level, local when nested |
| `Function <name> …` | Function | global / local |
| `Class c<name> is a <parent>` | Class | global |
| `Object o<name> is a <class>` | Object | global at top level, local when nested |
| `Type t<name> Define … End_Type` | Struct | global |
| `String s<name>` / `Integer i<name>` / `Boolean b<name>` / `Handle ho<name>` / etc. | Variable | local to enclosing scope |

## Scope Accessibility Rules

1. Find the innermost scope containing the request position — the **request scope**.
2. A candidate is accessible if:
   - same document AND (request scope is the symbol's scope OR any descendant of it), OR
   - any document AND `visibility === 'global'`.
3. Return all accessible candidates; VSCode disambiguates.
4. When ranking is needed, prefer same-document over cross-file.

## Files Involved

- [server/src/server.ts](../../server/src/server.ts) — capability registration + `onDefinition` handler
- [server/src/Definitions/DefinitionFinder.ts](../../server/src/Definitions/DefinitionFinder.ts) — index storage and scope-based filter
- [server/src/Symbols/SymbolIndexBuilder.ts](../../server/src/Symbols/SymbolIndexBuilder.ts) — scope hierarchy and symbol extraction
- [server/src/Symbols/dataflexSymbols.ts](../../server/src/Symbols/dataflexSymbols.ts) — symbol type definitions
- [server/src/common/dataflexScopes.ts](../../server/src/common/dataflexScopes.ts) — scope types and begin/end keyword tables
- [client/src/outline/dataflexDefinitionProvider.ts](../../client/src/outline/dataflexDefinitionProvider.ts) — legacy client-side provider, retire once LSP path is functional

## Related Features

- [190 — Workspace Resolver](./190-workspace-resolver.md) — provides the ordered source-directory list used for cross-file resolution
- [200 — Workspace Symbol Index](./200-workspace-symbol-index.md) — populated from 190; this feature consumes it for cross-file lookups
- 110 — Go to Declaration — shares the resolver
- 300 — Find All References — depends on the same index

## TODO

Format: `[ ]` open / `[x]` done. Each line is `[state] YYYY-MM-DD — description` and a done line appends `(done YYYY-MM-DD)`.

- [x] 2026-05-14 — Register `definitionProvider: true` in server capabilities (done 2026-05-14)
- [x] 2026-05-14 — Wire `connection.onDefinition` handler with word-at-position lookup (done 2026-05-14)
- [x] 2026-05-14 — Implement `DefinitionFinder` scope-based filter (done 2026-05-14)
- [x] 2026-05-14 — Implement `SymbolIndexBuilder.buildScopeHierarchy` for Class/Object/Procedure/Function (done 2026-05-14)
- [ ] 2026-05-14 — Implement `SymbolIndexBuilder.buildSymbolIndex` to extract procedures, functions, classes, objects, types, and typed variables
- [ ] 2026-05-14 — Fix `DefinitionFinder.updateDocument` index key — currently keys by `name|type|uri|line` so `findDefinitions(name, …)` never hits the map; key by lowercased name
- [ ] 2026-05-14 — Add workspace-wide indexing on `onInitialized` using the flattened source-dir list from feature 190
- [ ] 2026-05-14 — Handle `workspace/didChangeWatchedFiles` to re-index on file add/remove/rename
- [ ] 2026-05-14 — Same-document-first ranking when multiple candidates remain
- [ ] 2026-05-14 — Retire the legacy client-side `DataFlexDefinitionProvider` once the LSP path resolves cross-file
