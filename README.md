# dataflex README

## Features

## Requirements

- Requires Node js 20+

## Building

- Requires Node.js 20+ (24.6.0 Used)
- [Download Node.js (current)](https://nodejs.org/en/download/current)

```bash
npm install -g @vscode/vsce
```

- Run .\Build.ps1

## Extension Settings

## Known Issues

### @types/node

Set version to 22 as 24 results in the following

```error
erver/node_modules/vscode-jsonrpc/lib/common/linkedMap.d.ts:28:5 - error TS2416: Property 'forEach' in type 'LinkedMap<K, V>' is not assignable to the same property in base type 'Map<K, V>'.
  Type '(callbackfn: (value: V, key: K, map: LinkedMap<K, V>) => void, thisArg?: any) => void' is not assignable to type '(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any) => void'.
    Types of parameters 'callbackfn' and 'callbackfn' are incompatible.
      Types of parameters 'map' and 'map' are incompatible.
        Type 'LinkedMap<K, V>' is not assignable to type 'Map<K, V>'.
          The types returned by 'entries()' are incompatible between these types.
            Property '[Symbol.dispose]' is missing in type 'IterableIterator<[K, V]>' but required in type 'MapIterator<[K, V]>'.

```

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.1

Initial Build