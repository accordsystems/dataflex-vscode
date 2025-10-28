# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension providing language support for DataFlex through a Language Server Protocol (LSP) implementation. The extension provides syntax highlighting, validation, code actions, symbol navigation, and "go to definition" support for DataFlex source files.

## Build and Development Commands

### Initial Setup
```bash
npm install
```
This runs postinstall script which installs dependencies in both client and server directories.

### Building
```bash
npm run compile
```
Compiles TypeScript using `tsc -b` (project references build mode).

```bash
npm run watch
```
Compiles in watch mode for active development.

### Packaging
```bash
npm run package
```
Creates a .vsix package file using vsce. Alternatively, use `.\client\build.ps1` on Windows which compiles and packages in one step.

## Architecture

### Project Structure

This is a multi-part TypeScript project using TypeScript project references:
- **client/** - VSCode extension client
- **server/** - Language Server Protocol server

Both compile to `out/` directories in their respective folders.

### Client Architecture (client/src/)

Entry point: `extension.ts`

The client activates multiple providers:
1. **Language Client** (`languageClient/dataflexLanguageClient.ts`) - Connects to LSP server
2. **Definition Provider** (`outline/dataflexDefinitionProvider.ts`) - Handles "go to definition" requests
3. **Document Symbol Provider** (`outline/dataflexDocumentSymbolProvider.ts`) - Provides document outline
4. **Commands** (`commands/compileConsoleMode.ts`) - Custom command to compile DataFlex console mode programs via PowerShell script

The client also checks source file encoding on activation (`utils/checkSrcEncoding.ts`), warning if files are not cp437 encoded.

### Server Architecture (server/src/)

Entry point: `server.ts`

The server uses the Language Server Protocol to provide:
- **Validation** (`validation/DataFlexValidator.ts`) - Real-time diagnostics for keyword casing errors
- **Code Actions** (`codeActions/DataflexCodeActions.ts`) - Quick fixes (e.g., case corrections)
- **Symbol Indexing** (`Symbols/SymbolIndexBuilder.ts`) - Builds scope hierarchy and symbol index
- **Definition Finding** (`Definitions/DefinitionFinder.ts`) - Resolves symbol definitions across documents
- **Completion** - Currently has placeholder implementation with TypeScript/JavaScript examples

Key data structures:
- **dataflexKeywords.ts** - Keyword definitions and regex patterns for validation
- **dataflexScopes.ts** - Scope types (Class, Procedure, Function, etc.) and scope management
- **dataflexSymbols.ts** - Symbol definitions and types
- **dataflexVariables.ts** - Variable type definitions

### LSP Communication Flow

1. Document changes trigger `validateTextDocument()` and `SymbolIndexBuilder.indexDocument()`
2. Diagnostics are sent back to client via `connection.sendDiagnostics()`
3. Code actions are provided via `connection.onCodeAction()`
4. Definition requests are handled via `connection.onDefinition()` using `DefinitionFinder`

## DataFlex File Extensions

The extension recognizes these DataFlex file extensions: `.src`, `.vw`, `.sl`, `.dg`, `.rv`, `.bp`, `.pkg`, `.wo`, `.dd`, `.inc`, `.tpl`, `.cmd`, `.dfo`

## Configuration

Settings in `package.json` under `contributes.configuration`:
- `dataflex.languageServer.maxNumberOfProblems` - Maximum diagnostic problems (default: 100)
- `dataflex.consoleMode.compileScriptPath` - Path to PowerShell compile script

## Known Issues

### @types/node Version Lock

Must use `@types/node@^22` instead of newer versions. Version 24+ causes TypeScript compilation errors related to `vscode-jsonrpc` LinkedMap forEach signatures and Symbol.dispose compatibility issues.

## Development Notes

### Scope System

The scope system (`dataflexScopes.ts` and `SymbolIndexBuilder.ts`) builds a hierarchy of scopes by:
1. Creating a global scope for the document
2. Scanning for scope-begin keywords (Class, Procedure, Function, etc.)
3. Matching scope-end keywords to close scopes
4. Building a scope stack to track parent-child relationships

This enables context-aware symbol resolution and "go to definition" across scope boundaries.

### Validation System

Validation runs on document changes and checks:
- Keyword casing (enforces proper capitalization like "Object", "Class", "Procedure")
- Uses precompiled regex patterns from `dataflexKeywords.ts` for performance
- Generates warnings with code actions for auto-fixing

### Symbol Indexing

Currently under development. The infrastructure exists in `SymbolIndexBuilder.ts` but symbol extraction logic is placeholder. The index is updated on every document change and used by `DefinitionFinder`.
