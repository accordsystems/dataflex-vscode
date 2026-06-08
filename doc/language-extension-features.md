# Language Extension Features — Planning Reference

This document lists the standard features a mature VSCode language extension provides, with notes on implementation approach and priority for the DataFlex extension.

Status legend: ✅ Done | 🔨 In Progress | ⬜ Not Started

---

## Feature List

### 1. Syntax Highlighting ✅

Tokenizes source files so keywords, strings, comments, operators, and identifiers render in distinct colors.

**Implementation:** TextMate grammar (`.tmLanguage.json`). Runs in the extension host without the language server.

**DataFlex status:** Implemented in `client/src/syntaxes/dataflex.tmLanguage.json`.

---

### 2. Language Configuration ✅

Defines bracket pairs, comment toggling, auto-closing pairs, and indentation rules.

**Implementation:** `language-configuration.json` registered in `package.json`.

**DataFlex status:** Implemented in `client/src/syntaxes/language-configuration.json`.

---

### 3. Diagnostics / Validation ✅

Reports errors and warnings inline as the user types, using squiggly underlines.

**Implementation:** LSP `textDocument/publishDiagnostics`. Server parses the document and sends a `Diagnostic[]` array.

**DataFlex status:** Keyword casing validation implemented. Scope/type validation not yet done.

**Future work:**
- Undefined variable/procedure references
- Type mismatch warnings
- Missing `End_Function` / `End_Procedure` detection

---

### 4. Code Actions (Quick Fixes & Refactors) ✅

Offers fixes for diagnostics (light-bulb menu) and refactoring options via right-click.

**Implementation:** LSP `textDocument/codeAction`. Server returns `CodeAction[]` with `WorkspaceEdit` payloads.

**DataFlex status:** Keyword casing quick-fix implemented for `procedure` and `function`.

**Future work:**
- Fix all keyword casing in file
- Extract selection into procedure/function
- Rename symbol (see §11)

---

### 5. Document Symbols (Outline) ✅

Populates the outline panel and breadcrumb with a tree of named symbols in the current file.

**Implementation:** `DocumentSymbolProvider` in the client, or LSP `textDocument/documentSymbol`.

**DataFlex status:** Implemented in `client/src/outline/dataflexDocumentSymbolProvider.ts`.

---

### 6. Go to Definition 🔨

Navigates to where a symbol is declared when the user presses F12 or right-clicks → Go to Definition.

**Implementation:** LSP `textDocument/definition`. Server looks up the symbol name in the indexed symbol table and returns a `Location`.

**DataFlex status:** Infrastructure in place (`DefinitionFinder.ts`, `SymbolIndexBuilder.ts`). Symbol extraction (`buildSymbolIndex`) is the missing piece.

**Implementation plan:**
1. Complete `buildSymbolIndex` to extract all variable, procedure, function, class, and object declarations from a document.
2. Store each symbol with: name, kind, location (uri + range), visibility (global/local), enclosing scope.
3. On a definition request, resolve the word under the cursor, filter candidates by scope accessibility, return the best match location.
4. Handle multi-file workspace: index all open and relevant files, not just the active document.

**Key scoping rules for DataFlex:**
- Procedures/Functions/Classes/Objects declared at file top level are globally visible within that file and can be seen by files that `#INCLUDE` them.
- Variables declared inside a Procedure or Function are local to that scope.
- Variables declared inside a Class/Object are accessible to methods within that class/object.

---

### 7. Go to Declaration ⬜

Navigates to the point where a symbol is declared (as opposed to defined/implemented). In DataFlex these are often the same location.

**Implementation:** LSP `textDocument/declaration`. Usually shares logic with Go to Definition.

---

### 8. Find All References ⬜

Lists every location where a symbol is used across the workspace.

**Implementation:** LSP `textDocument/references`. Requires a full workspace index. Server searches all indexed documents for the symbol name within accessible scopes.

**Prerequisite:** Workspace-wide symbol index (see §6 and §15).

---

### 9. Hover ⬜

Shows a tooltip with documentation or type information when the cursor rests on a symbol.

**Implementation:** LSP `textDocument/hover`. Returns a `Hover` with `MarkupContent` (markdown).

**DataFlex use cases:**
- Built-in function signatures and descriptions (e.g., `Mid(string, length, start)`)
- User-defined procedure/function signatures extracted from the symbol index
- Variable type information
- Keyword documentation

**Data needed:** A map of built-in keyword/function names → markdown descriptions.

---

### 10. Completion (IntelliSense) ⬜

Suggests completions as the user types.

**Implementation:** LSP `textDocument/completion`. Returns `CompletionItem[]`. Optionally, `completionItem/resolve` fetches documentation lazily.

**DataFlex completion categories:**
- Keywords (already enumerated in `dataflexKeywords.ts`)
- Variable types (`String`, `Integer`, `Boolean`, `Handle`, etc.)
- User-defined procedures, functions, objects, classes (from workspace index)
- Properties and methods of an object (requires type inference)
- `#INCLUDE` file paths (trigger on `#INCLUDE "`)
- Member access after `of` keyword (e.g., `Get PropertyName of oObject`)

**Note:** The current placeholder returns TypeScript samples — this needs to be replaced.

---

### 11. Rename Symbol ⬜

Renames all occurrences of a symbol across the workspace atomically.

**Implementation:** LSP `textDocument/rename` + optional `textDocument/prepareRename`. Returns a `WorkspaceEdit` with all text replacements.

**Prerequisite:** Find All References (§8).

---

### 12. Signature Help ⬜

Shows the parameter list of a procedure or function call while the user is typing arguments.

**Implementation:** LSP `textDocument/signatureHelp`. Returns `SignatureInformation[]` with `ParameterInformation[]`. Triggered by `(` and `,`.

**DataFlex specifics:** DataFlex uses `Get FunctionName param1 param2 to result` and `Send ProcedureName param1 param2` syntax, which differs from typical C-style calls. The signature trigger characters and parsing logic need to account for this.

---

### 13. Document Formatting ⬜

Formats an entire document or a selected range on demand (Format Document / Format Selection).

**Implementation:** LSP `textDocument/formatting` and `textDocument/rangeFormatting`.

**DataFlex formatting rules (from style guide):**
- 4-space indentation
- PascalCase keywords
- 120-character line limit
- One blank line between procedures/functions
- Aligned `Move … to …` statements within a block

---

### 14. Folding Ranges ⬜

Adds collapse/expand controls in the gutter for code blocks.

**Implementation:** LSP `textDocument/foldingRange`, or a client `FoldingRangeProvider`.

**DataFlex fold points:**
- `Class` … `End_Class`
- `Object` … `End_Object`
- `Procedure` … `End_Procedure`
- `Function` … `End_Function`
- `If` … `End` / `Begin` … `End`
- `Case Begin` … `Case End`
- `Type … Define` … `End_Type`
- `#IFDEF` … `#ENDIF`

---

### 15. Workspace Symbol Search ⬜

Lets users search for any symbol across the entire workspace with Ctrl+T (Go to Symbol in Workspace).

**Implementation:** LSP `workspace/symbol`. Returns a flat list of `SymbolInformation[]` matching the query string.

**Prerequisite:** Workspace-wide file indexing. All workspace DataFlex files must be parsed and their symbols stored in a persistent in-memory index that is updated as files change.

**Index lifecycle:**
1. On server start: scan all workspace `.pkg`, `.src`, `.wo`, `.dd`, etc. files and index them.
2. On `textDocument/didChange`: re-index the changed document.
3. On `workspace/didChangeWatchedFiles`: re-index added/removed/renamed files.

---

### 16. Semantic Tokens ⬜

Provides richer, language-aware colorization beyond what TextMate grammars can express — e.g., distinguishing a local variable from a parameter, or a user-defined class name from a built-in.

**Implementation:** LSP `textDocument/semanticTokens/full` and `/range`. Server emits token data as a compact integer array. Requires registering a token legend in server capabilities.

---

### 17. Inlay Hints ⬜

Shows inline annotations next to code, such as parameter names or inferred types, without modifying the source.

**Implementation:** LSP `textDocument/inlayHint`.

**DataFlex use cases:**
- Parameter name labels on `Get`/`Send` calls
- Inferred variable type after `Move … to …`

---

### 18. Code Lens ⬜

Displays actionable, non-intrusive annotations above symbols (e.g., "3 references", "Run Test").

**Implementation:** LSP `textDocument/codeLens` + `codeLens/resolve`.

**DataFlex use cases:**
- Reference count above procedure/function definitions
- Link to run a DataFlex compile or test

---

### 19. Call Hierarchy ⬜

Shows what a procedure/function calls and what calls it, in a tree view.

**Implementation:** LSP `textDocument/prepareCallHierarchy`, `callHierarchy/incomingCalls`, `callHierarchy/outgoingCalls`.

**Prerequisite:** Workspace-wide index with call-site tracking.

---

### 20. Type Hierarchy ⬜

Shows the inheritance chain for a class — its parent and subclasses.

**Implementation:** LSP `textDocument/prepareTypeHierarchy`, `typeHierarchy/supertypes`, `typeHierarchy/subtypes`.

**DataFlex specifics:** Classes use `Class cMyClass is a cParentClass`. The hierarchy can be built by parsing `is a` declarations across the workspace.

---

### 21. Document Links ⬜

Makes `#INCLUDE "filename.pkg"` paths clickable, opening the referenced file.

**Implementation:** LSP `textDocument/documentLink`. Returns `DocumentLink[]` with target URIs resolved relative to the workspace.

---

### 22. Document Color ⬜

Detects color literals and shows an inline color swatch with a color picker on click.

**DataFlex relevance:** Low. DataFlex does not commonly use color literals.

---

### 23. On-Type Formatting ⬜

Formats a line or block automatically as the user types specific trigger characters (e.g., pressing Enter after `Begin`).

**Implementation:** LSP `textDocument/onTypeFormatting`. Trigger characters registered in server capabilities.

---

### 24. Snippet Completions ⬜

Inserts common boilerplate patterns via tab-stop templates.

**Implementation:** Registered in `package.json` `contributes.snippets`, pointing to a `.json` snippets file. No LSP required.

**Useful DataFlex snippets:**
- `proc` → `Procedure … End_Procedure` skeleton
- `func` → `Function … Returns … End_Function` skeleton
- `class` → `Class … is a … End_Class` skeleton
- `obj` → `Object … is a … End_Object` skeleton
- `if` → `If (…) Begin … End` block
- `for` → `For … from 0 to … Loop` block
- `case` → `Case Begin … Case End` block
- `struct` → `Type … Define … End_Type` skeleton
- Log calls: `log_debug`, `log_info`, `log_warn`, `log_error`

---

## Recommended Implementation Order

The following order balances user impact, implementation complexity, and dependency requirements.

| Priority | Feature | Reason |
|----------|---------|--------|
| 1 | **Go to Definition** (complete) | Most-requested navigation feature; infrastructure exists |
| 2 | **Snippet Completions** | High value, zero LSP dependency |
| 3 | **Folding Ranges** | Improves readability; straightforward regex-based implementation |
| 4 | **Hover** | Surfaces built-in function signatures; improves discoverability |
| 5 | **Workspace Symbol Index** | Prerequisite for References, Rename, workspace-wide Definition |
| 6 | **Completion (IntelliSense)** | Replaces broken placeholder; depends on symbol index |
| 7 | **Find All References** | Depends on workspace symbol index |
| 8 | **Rename Symbol** | Depends on Find All References |
| 9 | **Document Links** (`#INCLUDE`) | Useful, low complexity |
| 10 | **Signature Help** | Improves call-site experience; needs DataFlex-specific parsing |
| 11 | **Document Formatting** | Requires DataFlex formatting rules implementation |
| 12 | **Semantic Tokens** | Polish; requires mature symbol index |
| 13 | **Diagnostics (extended)** | Undefined references, type errors |
| 14 | **Call Hierarchy** | Advanced; requires call-site tracking |
| 15 | **Type Hierarchy** | Advanced; requires class index |

---

## Go to Definition — Detailed Plan

This is the next active feature. The infrastructure exists; what is missing is symbol extraction.

### Data Model

```typescript
interface SymbolDefinition {
    name: string;           // e.g. "MyProcedure"
    kind: DataFlexSymbolType; // Procedure | Function | Variable | Class | Object | ...
    uri: string;            // Document URI
    range: Range;           // Full definition range
    selectionRange: Range;  // Name range (for highlighting)
    visibility: 'local' | 'global';
    scopeId: string | null; // ID of enclosing scope, or null for top-level
}
```

### Symbols to Extract

| Pattern | Kind | Visibility |
|---------|------|-----------|
| `Procedure ProcName …` | Procedure | global (file-level) / local (nested) |
| `Function FuncName …` | Function | global / local |
| `Class cClassName is a …` | Class | global |
| `Object oObjName is a …` | Object | global / local |
| `Type tTypeName Define` | Struct | global |
| `Integer iVarName` / `String sVarName` / etc. | Variable | local to enclosing scope |
| `Boolean bVarName` etc. | Variable | local |
| `Handle hoVarName` | Variable | local |

### Scope Accessibility Rules

1. **Definition request received** for symbol `S` at position `P` in document `D`.
2. Find the innermost scope containing `P` → this is the "request scope".
3. Candidates: all symbols with name `S` where:
   - Same document, same scope or any ancestor scope, OR
   - Any document, global visibility
4. If multiple candidates, prefer same-document over cross-file.

### File Scanning Strategy

On server startup and on `workspace/didChangeWatchedFiles`:
1. Enumerate all workspace DataFlex files using `workspace.findFiles('**/*.{pkg,src,wo,dd,inc}')`.
2. Parse each file for symbol declarations using a line-by-line regex scan.
3. Store results in a `Map<uri, SymbolDefinition[]>`.
4. On document change, re-index that document only.
