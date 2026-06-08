# DataFlex VSCode Extension — Overview

## Summary

A Visual Studio Code language extension for DataFlex, implemented using the Language Server Protocol (LSP). Provides syntax highlighting, real-time diagnostics, code actions, document outline, go-to-definition, and a compile command.

---

## Supported File Types

| Extension | Description |
|-----------|-------------|
| `.src` | Main application source |
| `.pkg` | Package/include |
| `.wo` | Web object |
| `.dd` | Data dictionary |
| `.vw` | View |
| `.sl` | Sublist |
| `.dg` | Dialog |
| `.rv` | Report view |
| `.bp` | Business process |
| `.inc` | Include file |
| `.tpl` | Template |
| `.cmd` | Command |
| `.dfo` | DataFlex object |

Language ID: `dataflex`

---

## Architecture

The extension uses a client-server architecture following the LSP specification.

```
VSCode Extension Host (client/)
    ├── extension.ts              Activation, provider registration
    ├── languageClient/           LSP client transport (IPC)
    ├── outline/                  DocumentSymbolProvider
    ├── commands/                 Compile command
    ├── utils/                    Encoding checker
    ├── constants/                Keyword categories
    └── syntaxes/                 TextMate grammar + language config

Language Server (server/)
    ├── server.ts                 LSP server entry point
    ├── validation/               Keyword casing diagnostics
    ├── codeActions/              Quick-fix code actions
    ├── Symbols/                  Scope + symbol index infrastructure
    ├── Definitions/              Definition finder
    └── common/                   Shared types: keywords, scopes, variables
```

Communication is over IPC. The server handles diagnostics, code actions, and definition requests. The client handles document symbols (outline) and the definition provider UI.

---

## Implemented Features

### Syntax Highlighting

File: `client/src/syntaxes/dataflex.tmLanguage.json`

TextMate grammar covering:
- Control keywords: `If`, `Else`, `Begin`, `End`, `For`, `While`, `Loop`, `Case`
- Declaration keywords: `Class`, `Object`, `Procedure`, `Function`, `Struct`, `Screen`
- Directives: `#INCLUDE`, `#COMMAND`, `#IFDEF`, `#IFNDEF`, `#ELSE`, `#ENDIF`, `#REPLACE`
- Operators: arithmetic (`+`, `-`, `*`, `/`), boolean (`And`, `Or`, `Not`), comparison (`=`, `<>`, `<`, `>`, `<=`, `>=`)
- Comments: `//` single-line
- String literals
- Labels

### Keyword Casing Validation

Files: `server/src/validation/DataFlexValidator.ts`, `server/src/common/dataflexKeywords.ts`

On every document change, validates that DataFlex keywords use correct PascalCase (e.g., `procedure` → `Procedure`, `function` → `Function`). Keyword definitions are stored with a `firstWordOnly` flag to avoid false positives in strings or identifiers.

### Code Actions (Quick Fixes)

File: `server/src/codeActions/DataflexCodeActions.ts`

Provides quick-fix code actions for keyword casing diagnostics. Currently handles `procedure` → `Procedure` and `function` → `Function` corrections.

### Document Symbols (Outline)

File: `client/src/outline/dataflexDocumentSymbolProvider.ts`

Populates the VSCode outline panel and breadcrumb with a nested symbol tree for the current document. Recognized symbol types:

| Symbol Kind | Patterns Detected |
|-------------|------------------|
| Class | `Class …` / `End_Class` |
| Function | `Function …` |
| Procedure | `Procedure …` |
| Object | `Object … is a …` / `End_Object` |
| Struct | `Type … Define` / `End_Type` |
| Screen | `Screen …` |
| Command | `Command …` |
| Variable/Label | Label declarations |

Symbols are nested according to their enclosing scope (e.g., procedures inside a class).

### Go to Definition

Files: `client/src/outline/dataflexDefinitionProvider.ts`, `server/src/Definitions/DefinitionFinder.ts`

Finds the definition of a symbol under the cursor. Searches the current document and workspace files. Resolution considers scope visibility:
- Same document, same or child scope → accessible
- Global scope → accessible from anywhere

Infrastructure (`SymbolIndexBuilder.ts`) builds a scope hierarchy (start/end lines, parent-child nesting) for each document.

**Status:** Infrastructure is in place. Symbol extraction within scopes (`buildSymbolIndex`) is a placeholder — this is the active area of development.

### Compile Command

File: `client/src/commands/compileConsoleMode.ts`

Command ID: `dataflex.compileConsoleMode`

Opens the VSCode integrated terminal and runs a configurable PowerShell compile script with the current file as an argument.

### Encoding Check

File: `client/src/utils/checkSrcEncoding.ts`

Warns users when a `.src` file is open that they should set the file encoding to CP437 (the encoding DataFlex expects).

---

## Configuration Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `dataflex.languageServer.maxNumberOfProblems` | integer | 100 | Maximum diagnostics to report per document |
| `dataflex.consoleMode.compileScriptPath` | string | — | Path to the DataFlex PowerShell compile script |

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | TypeScript | 5.9.2 |
| VSCode API | vscode | ^1.103.0 |
| LSP Server | vscode-languageserver | 9.0.1 |
| LSP Client | vscode-languageclient/node | 9.0.1 |
| Text Document | vscode-languageserver-textdocument | 1.0.11 |
| Types | @types/node | ^22 (NOT 24+, see below) |
| Build | TypeScript project references (`tsc -b`) | — |
| Packaging | `vsce` | — |

**Known constraint:** `@types/node` must stay on `^22`. Version 24+ causes a TypeScript compile error due to a `LinkedMap.forEach` signature conflict in `vscode-jsonrpc`.

---

## Build & Development

```bash
# Install all dependencies (runs in both client/ and server/)
npm install

# Compile once
npm run compile

# Watch mode (incremental)
npm run watch

# Package as .vsix
npm run package
```

Debug configuration (`.vscode/launch.json`) launches the extension host and attaches to the server on port 6009.

---

## Current Limitations

- **Completions:** Placeholder implementation; returns TypeScript/JavaScript samples, not DataFlex.
- **Symbol extraction:** `SymbolIndexBuilder.buildSymbolIndex()` is an empty stub — symbol data is not yet populated.
- **Workspace-wide definitions:** Definition search is partially scoped to the current document; full workspace indexing is a TODO.
- **No tests:** No unit or integration tests exist yet.
