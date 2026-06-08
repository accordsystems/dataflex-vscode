# DataFlex Workspace Resolver — Implementation Plan

## Purpose

Enable the language server to know which directories contain DataFlex source files,
in the same order the DataFlex compiler searches them. This is a prerequisite for
workspace-wide features: Go to Definition, Find All References, and Completion.

---

## Background: The Workspace System

A DataFlex workspace is described by two file types.

### .sws file (Windows INI)

The top-level workspace descriptor. Example: `CARM-191.sws`

```ini
[Properties]
Version=19.1

[WorkspacePaths]
ConfigFile=.\Programs\Config.ws

[Conditionals]
Is$WebApp=True

[Projects]
Project0=WebApp.src

[Libraries]
Lib1=libs\DataFlex DateTime Library 24.0\DateTime - 191.sws
Lib2=libs\libi20\asgI20-191.sws
Lib3=libs\DataFlex Conversions Library 24.0\Conversions - 191.sws
```

Key observations:
- `ConfigFile` is relative to the **SWS file directory**.
- Library values (`Lib1`, `Lib2`, ...) are relative to the **SWS file directory**.
- Library keys appear in the file in source order; that order is preserved directly. JavaScript object key insertion order makes this automatic — no sort needed.
- Libraries can themselves have libraries (recursive, potentially deep).

### Config.ws file (Windows INI)

Each SWS (including each library's SWS) points to its own `Config.ws`. Example: `Programs/Config.ws`

```ini
[Workspace]
Home=..\
AppSrcPath=.\AppSrc
AppHTMLPath=.\AppHtml
DDSrcPath=.\DDSrc;.\Libs\LibI20\DDSrc;.\Libs\LibI20\Libs\LibAsg\DDSrc
DataPath=D:\env\Dat.PHD
FileList=D:\env\Dat.PHD\filelist.cfg
```

Key observations:
- `Home` is relative to the **Config.ws file directory**.
- `AppSrcPath`, `DDSrcPath`, etc. are relative to **Home**.
- `DDSrcPath` can be **semicolon-separated** (multiple paths).
- `DataPath` and `FileList` may be **absolute** paths on an external drive.

### Path resolution summary

| Value | Resolved relative to |
|-------|----------------------|
| `ConfigFile` in .sws | Directory of the .sws file |
| `Lib1`, `Lib2`, ... in .sws | Directory of the .sws file |
| `Home` in Config.ws | Directory of the Config.ws file |
| `AppSrcPath` in Config.ws | `Home` |
| `DDSrcPath` in Config.ws | `Home` (each semicolon segment separately) |
| `DataPath` in Config.ws | May be absolute; if relative, resolve from `Home` |
| `FileList` in Config.ws | May be absolute; if relative, resolve from `Home` |

---

## New Configuration Setting

Add to `package.json` → `contributes.configuration.properties`:

```json
"dataflex.workspace.swsFile": {
    "type": "string",
    "default": "",
    "description": "Absolute path to the DataFlex .sws workspace file. Used to resolve source and library paths for Go to Definition, completion, and other language features."
}
```

---

## New File: `server/src/workspace/DataFlexWorkspaceResolver.ts`

### Data Types

```typescript
export type SourceKind = 'appSrc' | 'ddSrc';

export interface ResolvedSourceDir {
    absolutePath: string;
    kind: SourceKind;
    swsOrigin: string;  // Absolute path of the .sws that contributed this dir
    depth: number;      // 0 = main workspace, 1 = direct library, etc.
}

export interface ParsedSws {
    swsPath: string;
    swsDir: string;
    version: string;
    projectFileNames: string[];  // Relative paths of .src entry points (Project0=, Project1=, ...)
    conditionals: Record<string, string>;
    configFilePath: string;
    librarySwsPaths: string[];  // Source order — matches declaration order in the [Libraries] section
}

export interface ParsedConfigWs {
    configPath: string;
    homeDir: string;
    appSrcDirs: string[];   // Resolved absolute paths
    ddSrcDirs: string[];    // Resolved absolute paths (expanded from semicolons)
    dataDirs: string[];     // Resolved absolute paths (expanded from semicolons; may be absolute)
    filelistPath: string;
}

export interface ResolvedWorkspace {
    swsPath: string;
    version: string;
    conditionals: Record<string, string>;
    sourceDirs: ResolvedSourceDir[];        // From this workspace only
    config: ParsedConfigWs;
    libraries: ResolvedWorkspace[];         // Recursively resolved
}
```

---

## Implementation Steps

### Step 1 — INI Parser (`parseIni`)

**Input:** Raw file content as a string.
**Output:** `Record<string, Record<string, string>>` — section name → key → value.

Rules:
- Lines starting with `;` or `#` are comments — skip.
- Empty lines — skip.
- `[SectionName]` starts a new section.
- `Key=Value` adds an entry to the current section.
- Everything after the first `=` is the value (values can contain `=`).

```typescript
static parseIni(content: string): Record<string, Record<string, string>>
```

---

### Step 2 — Path Helper (`resolvePath`)

**Purpose:** Resolve a Windows-style relative path (may use backslashes) against a
base directory. Safe on both Windows and non-Windows hosts.

```typescript
private static resolvePath(base: string, relative: string): string
// Replace backslashes with forward slashes, then use path.resolve(base, relative)
```

---

### Step 3 — SWS Parser (`parseSws`)

**Input:** Absolute path to a `.sws` file.
**Output:** `ParsedSws`

Steps:
1. Read file, call `parseIni`.
2. Extract `version` from `[Properties].Version`.
3. Extract `projectFileNames` from `[Projects]`: collect values in source order, resolve each path against `swsDir`.
4. Resolve `configFilePath` using `[WorkspacePaths].ConfigFile` relative to `swsDir`.
5. Extract library paths from `[Libraries]`: collect values in source order (insertion order of the parsed section object), resolve each path.

```typescript
static parseSws(swsPath: string): ParsedSws
```

---

### Step 4 — Config.ws Parser (`parseConfigWs`)

**Input:** Absolute path to a `Config.ws` file.
**Output:** `ParsedConfigWs`

Steps:
1. Read file, call `parseIni`.
2. Resolve `homeDir` = `resolvePath(configDir, ini['Workspace']['Home'])`.
3. `appSrcDirs` = split `AppSrcPath` on `;`, resolve each against `homeDir`.
4. `ddSrcDirs` = split `DDSrcPath` on `;`, resolve each against `homeDir`.
5. `dataDirs` = split `DataPath` on `;`, resolve each against `homeDir` (segments may already be absolute — `path.resolve` handles this).
6. `filelistPath` = resolve `FileList` against `homeDir`.

```typescript
static parseConfigWs(configPath: string): ParsedConfigWs
```

---

### Step 5 — Recursive Resolver (`resolve`)

**Input:** Absolute path to a `.sws` file, a `visited` Set for cycle detection, and `depth`.
**Output:** `ResolvedWorkspace | null`

Steps:
1. Normalise the path, check for cycles (`visited.has`), check file exists.
2. Add to `visited`.
3. Call `parseSws`.
4. If `configFilePath` exists, call `parseConfigWs`; otherwise use empty defaults.
5. Build `sourceDirs` from `config.appSrcDirs` and `config.ddSrcDirs`.
6. For each `librarySwsPaths` entry, call `resolve` recursively (same `visited` set, `depth + 1`).
7. Return `ResolvedWorkspace`.

```typescript
static resolve(
    swsPath: string,
    visited?: Set<string>,
    depth?: number
): ResolvedWorkspace | null
```

---

### Step 6 — Flatten (`flattenSourceDirs`)

**Input:** `ResolvedWorkspace`
**Output:** `ResolvedSourceDir[]` — ordered, deduplicated

Walk the tree depth-first:
1. Emit this workspace's `sourceDirs` (skipping duplicates by lowercased path).
2. Recurse into each library in order.

This matches the DataFlex compiler search order: main workspace first, then
libraries in declaration order, each library's own dependencies before the
next sibling library.

```typescript
static flattenSourceDirs(workspace: ResolvedWorkspace): ResolvedSourceDir[]
```

---

### Step 7 — Convenience Methods

```typescript
// Returns ordered appSrc absolute paths only
static getAppSrcPaths(swsPath: string): string[]

// Returns ordered ddSrc absolute paths only
static getDdSrcPaths(swsPath: string): string[]
```

---

## Integration Points (after resolver is built)

### Server (`server/src/server.ts`)

1. On `connection.onInitialized`:
   - Read `dataflex.workspace.swsFile` from configuration.
   - Call `DataFlexWorkspaceResolver.resolve(swsPath)`.
   - Store the result and pass source paths to the symbol indexer.

2. On `connection.onDidChangeConfiguration`:
   - If `dataflex.workspace.swsFile` changed, re-resolve and re-index.

### Symbol Indexer (`SymbolIndexBuilder.ts`)

Once the resolver provides an ordered list of directories, the indexer can:
- Enumerate all `.pkg`, `.src`, `.wo`, `.inc`, `.dd` files in those directories.
- Parse each file and add its symbols to the workspace index.
- Use the search-order list to resolve `#INCLUDE` references correctly.

---

## File Location

```
server/src/workspace/DataFlexWorkspaceResolver.ts
```

No new dependencies required — uses only Node.js built-ins (`fs`, `path`).
