# Feature 190 — Workspace Resolver

**Status:** In Progress

## Goal

Enumerate the directories that contain DataFlex source files in the same order the DataFlex compiler searches them. No LSP capability of its own; this is the data layer that every workspace-wide feature depends on — cross-file Go to Definition (100), Workspace Symbol Index (200), Find All References (300), and `USE`/`#INCLUDE` resolution.

Full design reference: [doc/workspace-resolver-plan.md](../workspace-resolver-plan.md).

## Background

A DataFlex workspace is described by two INI file types.

**`.sws`** — top-level workspace descriptor:
- `[Properties]` — Version.
- `[WorkspacePaths]` — `ConfigFile=` relative path to this workspace's `Config.ws`.
- `[Projects]` — `Project0=…`, `Project1=…` entry-point `.src` files.
- `[Libraries]` — `Lib1=…`, `Lib2=…` each pointing at another `.sws`.
- `[Conditionals]` — flags consumed by `#IFDEF` blocks; not used by the resolver.

All paths in the SWS are relative to the SWS file's directory. **Library order follows source order in the file** — the `Lib1`, `Lib2`, … naming is a user convention, not a processing rule. Whatever order the lines appear in the `.sws` is the order the resolver walks them. Libraries can themselves declare libraries → recursive, potentially cyclic.

**`Config.ws`** — per-workspace source and data paths:
- `[Workspace].Home=` relative to the Config.ws directory.
- `AppSrcPath`, `DDSrcPath`, `DataPath`, `FileList` — each relative to `Home`, each potentially semicolon-separated.

The compiler search order matches a depth-first walk: main workspace's directories first, then each library in declaration order, each library's transitive dependencies before its next sibling. Same-name files are shadowed by whichever appears first. The resolver must reproduce this exactly so `USE foo.pkg` resolves to the same file the compiler picks.

## Path Resolution Reference

| Value | Resolved relative to |
|-------|----------------------|
| `ConfigFile` in `.sws` | Directory of the `.sws` file |
| `Lib1`, `Lib2`, … in `.sws` | Directory of the `.sws` file |
| `Project0`, `Project1`, … in `.sws` | Directory of the `.sws` file |
| `Home` in `Config.ws` | Directory of the `Config.ws` file |
| `AppSrcPath` in `Config.ws` | `Home` (semicolons split into segments) |
| `DDSrcPath` in `Config.ws` | `Home` (semicolons split into segments) |
| `DataPath` in `Config.ws` | `Home`; may be absolute |
| `FileList` in `Config.ws` | `Home`; may be absolute |

## Data Model

```typescript
type SourceKind = 'appSrc' | 'ddSrc';

interface ResolvedSourceDir {
    absolutePath: string;
    kind: SourceKind;
    swsOrigin: string;   // Absolute path of the .sws that contributed this dir
    depth: number;       // 0 = main workspace, 1 = direct library, etc.
}

interface ParsedSws {
    swsPath: string;
    swsDir: string;
    version: string;
    projectFileNames: string[];          // Relative paths of .src entry points
    conditionals: Record<string, string>;
    configFilePath: string;
    librarySwsPaths: string[];           // Numerically sorted
}

interface ParsedConfigWs {
    configPath: string;
    homeDir: string;
    appSrcDirs: string[];                // Resolved absolute, semicolon-expanded
    ddSrcDirs: string[];                 // Resolved absolute, semicolon-expanded
    dataDirs: string[];                  // Resolved absolute, semicolon-expanded
    filelistPath: string;
}

interface ResolvedWorkspace {
    swsPath: string;
    version: string;
    conditionals: Record<string, string>;
    sourceDirs: ResolvedSourceDir[];     // This workspace only
    config: ParsedConfigWs;
    libraries: ResolvedWorkspace[];      // Recursively resolved
}
```

## Resolution Algorithm

1. **parseIni(text)** → `section → key → value`. Case-insensitive sections and keys. First `=` is the separator; values may contain `=`. Last write wins on duplicate keys. Throws on malformed lines.
2. **resolvePath(base, relative)** → replace `\` with `/`, then `path.resolve(base, relative)` so Windows paths work on any host.
3. **parseSws(swsPath)** → read + parseIni; extract version, conditionals, project filenames; resolve `ConfigFile` against the SWS dir; collect `[Libraries]` values in source order and resolve each path against `swsDir`. JavaScript objects preserve insertion order for string keys, so `Object.values` on the parsed `[Libraries]` section gives source order for free — no explicit sort needed.
4. **parseConfigWs(configPath)** → resolve `Home` against the Config.ws dir; split semicolon-separated `AppSrcPath` / `DDSrcPath` / `DataPath` and resolve each segment against `Home`.
5. **resolve(swsPath, visited, depth)** → recursive entry point. Tracks a `visited` set keyed on lowercased absolute normalized paths for cycle protection. Carries `depth` so consumers can prefer main-workspace symbols.
6. **flattenSourceDirs(workspace)** → depth-first walk yielding an ordered, deduplicated `ResolvedSourceDir[]`. Dedup key = lowercased absolute path; first occurrence wins (shadowing).
7. **getAppSrcPaths / getDdSrcPaths** → convenience filters over the flattened list.

## Configuration Surface

`package.json` adds:

```json
"dataflex.workspace.swsFile": {
    "type": "string",
    "default": "",
    "description": "Absolute path to the DataFlex .sws workspace file."
}
```

The server reads this on `onInitialized` and again on `onDidChangeConfiguration`, re-resolving and re-indexing whenever it changes.

## Files Involved

- [server/src/workspace/DataflexWorkspaceResolver.ts](../../server/src/workspace/DataflexWorkspaceResolver.ts)
- [server/src/workspace/DataflexWorkspaceResolver.test.ts](../../server/src/workspace/DataflexWorkspaceResolver.test.ts)
- [server/src/server.ts](../../server/src/server.ts) — wiring target
- [package.json](../../package.json) — `dataflex.workspace.swsFile` setting
- [doc/workspace-resolver-plan.md](../workspace-resolver-plan.md) — deep design reference

## Related Features

- [100 — Go to Definition](./100-gotodefinition.md) — consumes the flattened source-dir list
- [200 — Workspace Symbol Index](./200-workspace-symbol-index.md) — enumerates files in resolver order to populate the symbol index
- 740 — Document Links — would use the resolver to make `#INCLUDE` paths clickable

## TODO

Format: `[ ]` open / `[x]` done. Each line is `[state] YYYY-MM-DD — description` and a done line appends `(done YYYY-MM-DD)`.

- [x] 2026-05-14 — Implement `parseIni` with case-insensitive sections/keys, `;`/`#` comments, CRLF, multi-`=` values, last-write-wins (done 2026-05-14)
- [x] 2026-05-14 — Unit tests for `parseIni` (done 2026-05-14)
- [x] 2026-05-14 — Implement `resolvePath` — normalize Windows backslashes, then `path.resolve(base, relative)` (done 2026-05-14)
- [x] 2026-05-14 — Tests for `resolvePath` — Windows backslash input on a non-Windows host, mixed separators, already-absolute "relative" path, `..` segments (done 2026-05-14)
- [x] 2026-05-14 — Implement `parseSws` — version, conditionals, projectFileNames, configFilePath, source-ordered librarySwsPaths resolved to absolute paths (done 2026-05-14)
- [x] 2026-05-14 — Implement `validateParsedSws` — required sections/keys, path existence checks for ConfigFile, projects, and libraries (done 2026-05-14)
- [x] 2026-05-14 — Tests for `parseSws` — library order matches source order (Lib2 before Lib1 in the file → that order in the output), missing `[Properties]`, missing `ConfigFile`, no `[Libraries]` section (done 2026-05-14)
- [x] 2026-05-14 — Implement `parseConfigWs` — Home resolution, semicolon-split AppSrcPath/DDSrcPath/DataPath (done 2026-05-21)
- [x] 2026-05-21 — Refactor `validateParsedSws` / `parseSws` to match Config.ws pattern: validate = structure only, `checkResolvedSwsPaths` = disk checks (done 2026-05-21)
- [x] 2026-05-21 — Implement `validateParsedWs` — structure-only checks, `appHTMLDir` treated as optional (done 2026-05-21)
- [x] 2026-05-21 — Implement `checkResolvedConfigWsPaths` — required: homeDir, appSrcDirs, ddSrcDirs, programPath, dataDirs, filelistPath; optional: appHTMLDir, bitmapDirs, ideSrcDirs, helpDirs (done 2026-05-21)
- [x] 2026-05-21 — Tests for `parseConfigWs` / `parseConfigWsContent` — semicolon expansion, absolute DataPath, missing `[Workspace]` section, optional fields absent (done 2026-05-21)
- [x] 2026-05-14 — Implement `resolve` — recursive walk with `visited` cycle protection and `depth` tracking (done 2026-05-22)
- [x] 2026-05-14 — Tests for `resolve` — simple workspace, two-level library, cyclic library reference, missing library file (done 2026-05-22)
- [x] 2026-05-14 — Implement `flattenSourceDirs` — depth-first walk, dedup by lowercased absolute path (done 2026-05-22)
- [x] 2026-05-14 — Tests for `flattenSourceDirs` — shadowing case (same dir in main + library yields one entry attributed to main) (done 2026-05-22)
- [x] 2026-05-14 — Implement convenience accessors `getAppSrcPaths` / `getDdSrcPaths` (done 2026-05-22)
- [ ] 2026-05-14 — Add `dataflex.workspace.swsFile` to `package.json` `contributes.configuration.properties`
- [ ] 2026-05-14 — Wire `connection.onInitialized` to read the setting and call the resolver
- [ ] 2026-05-14 — Wire `connection.onDidChangeConfiguration` to re-resolve when the setting changes
- [ ] 2026-05-14 — Update `workspace-resolver-plan.md` to match drift: `projectFileNames` in `ParsedSws`, `dataDirs: string[]` (not `dataPath: string`), pick one casing for `filelistPath`, library order is source order not numeric sort

Note: routing of `console.log` calls in `parseIni` is now tracked in [../maintenance.md](../maintenance.md#001--consolelog-in-server-code-is-not-routed-to-the-lsp-output-channel-under-ipc-transport) — not a 190-specific issue.
