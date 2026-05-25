# Feature Index

Master index of dataflex-vscode language features. One row per feature. When asked for the status of a feature, read its detail file (linked below) rather than relying on the summary here — the detail file is authoritative.

**Status legend:** ✅ Done · 🔨 In Progress · ⬜ Not Started

**Numbering convention:** features are grouped by decade so new items can slot in without renumbering.

- `0xx` — Editor surface (syntax, configuration)
- `1xx` — Navigation (definition, declaration, document symbols)
- `2xx` — Workspace indexing
- `3xx` — Cross-reference (find references, rename, call/type hierarchy)
- `4xx` — Authoring assistance (completion, hover, signature help, snippets)
- `5xx` — Diagnostics & code actions
- `6xx` — Formatting & on-type behavior
- `7xx` — Visual polish (semantic tokens, inlay hints, code lens, folding, document links, color)

When adding a new feature, pick the next free number in its decade and create `NNN-slug.md` alongside this index. Add a row here in numeric order.

## Feature file convention

The body of each feature file is **durable design content** — goal, background, data model, algorithms, file references, related features. It should change rarely.

All **churning state** lives in a single trailing `## TODO` section as a checklist:

```
- [x] 2026-05-14 — Implement parseIni (done 2026-05-14)
- [ ] 2026-05-14 — Implement resolvePath
```

- `[ ]` open, `[x]` done.
- Date after the brackets is the **date added**.
- When ticking, append `(done YYYY-MM-DD)`.
- Don't delete completed items — the TODO list doubles as the change log.

If a design decision genuinely changes, update the body of the file directly; don't track design drift in the TODO list.

## Features

| ID  | Feature | Status | Notes |
|-----|---------|--------|-------|
| 010 | Syntax Highlighting | ✅ | TextMate grammar at `client/src/syntaxes/dataflex.tmLanguage.json` |
| 020 | Language Configuration | ✅ | `client/src/syntaxes/language-configuration.json` |
| 100 | [Go to Definition](./100-gotodefinition.md) | 🔨 | Infrastructure done; `buildSymbolIndex` is a stub, no workspace scan yet |
| 110 | Go to Declaration | ⬜ | Shares resolver with 100 |
| 120 | Document Symbols (Outline) | ✅ | `client/src/outline/dataflexDocumentSymbolProvider.ts` |
| 190 | [Workspace Resolver](./190-workspace-resolver.md) | ✅ | All parsing, resolution, flattening, and server wiring complete. Prerequisite for 200. |
| 200 | [Workspace Symbol Index](./200-workspace-symbol-index.md) | 🔨 | Depends on 190. `WorkspaceIndex` singleton, background scan, `DefinitionFinder` refactor. Prerequisite for 100 (cross-file), 210, 300, 310 |
| 210 | Workspace Symbol Search (Ctrl+T) | ⬜ | Depends on 200 |
| 300 | Find All References | ⬜ | Depends on 200 |
| 310 | Rename Symbol | ⬜ | Depends on 300 |
| 320 | Call Hierarchy | ⬜ | Depends on 200 with call-site tracking |
| 330 | Type Hierarchy | ⬜ | Parse `Class … is a …` workspace-wide |
| 400 | Completion (IntelliSense) | ⬜ | Placeholder returns TS samples; replace |
| 410 | Hover | ⬜ | Built-in function signatures + user symbols from index |
| 420 | Signature Help | ⬜ | DataFlex `Get … to …` / `Send …` syntax differs from C-style |
| 430 | Snippet Completions | ⬜ | `package.json` `contributes.snippets`; no LSP needed |
| 500 | Diagnostics (keyword casing) | ✅ | `server/src/validation/DataFlexValidator.ts` |
| 510 | Diagnostics (extended) | ⬜ | Undefined refs, type mismatch, missing `End_Procedure`/`End_Function` |
| 520 | Code Actions (casing quick-fix) | ✅ | `server/src/codeActions/DataflexCodeActions.ts` |
| 530 | Code Actions (refactors) | ⬜ | Fix-all-casing, extract to procedure |
| 600 | Document Formatting | ⬜ | 4-space indent, PascalCase keywords, 120-col limit |
| 610 | On-Type Formatting | ⬜ | Triggers e.g. Enter after `Begin` |
| 700 | Folding Ranges | ⬜ | Class / Object / Procedure / Function / If / Case Begin / Type Define / `#IFDEF` |
| 710 | Semantic Tokens | ⬜ | Depends on mature symbol index |
| 720 | Inlay Hints | ⬜ | Parameter labels on `Get`/`Send` |
| 730 | Code Lens | ⬜ | Reference counts above procedure/function definitions |
| 740 | Document Links | ⬜ | Make `#INCLUDE "path"` clickable |
| 750 | Document Color | ⬜ | Low relevance for DataFlex |

## How Claude should use this index

1. When asked "what is the status of feature X" — look up X here, then read its detail file if it exists.
2. When status appears stale, verify against the actual source files before relying on it.
3. When recording new feature work, update both the detail file and the row in this table.
4. The decade-based numbering is for organization; gaps are intentional and fine to leave.
