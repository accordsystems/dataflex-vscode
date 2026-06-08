# Test Structure Plan for dataflex-vscode

## Context

The test framework (Mocha + @vscode/test-cli) is already installed but almost entirely unused.
Only one test file exists: `server/src/workspace/DataflexWorkspaceResolver.test.ts`.

This document describes how to structure tests going forward — covering both pure server-side
logic (Node.js unit tests) and client-side VS Code API features (Extension Host integration tests).

---

## Two-Tier Test Architecture

### Tier 1: Unit Tests (Server / Node.js)
- Run via: `npm run test:unit`
- No VS Code API needed — fast, isolated
- Co-located with source files as `*.test.ts`
- Pattern: `server/src/**/*.test.ts`
- Already configured in root `package.json`

### Tier 2: Integration Tests (Client / Extension Host)
- Run via: `npm test` (via `vscode-test`)
- Requires VS Code process — slow, needs full activation
- Lives in: `client/src/test/` folder
- Requires adding `.vscode-test.json` config (currently missing)

---

## Recommended File Structure

```
server/src/
├── validation/
│   ├── DataFlexValidator.ts
│   └── DataFlexValidator.test.ts          ← NEW: keyword casing diagnostics
├── Symbols/
│   ├── SymbolIndexBuilder.ts
│   └── SymbolIndexBuilder.test.ts         ← NEW: scope hierarchy parsing
├── Definitions/
│   ├── DefinitionFinder.ts
│   └── DefinitionFinder.test.ts           ← NEW: definition resolution
├── common/
│   ├── dataflexKeywords.ts
│   └── dataflexKeywords.test.ts           ← NEW: regex pattern tests
├── workspace/
│   ├── DataflexWorkspaceResolver.ts
│   └── DataflexWorkspaceResolver.test.ts  ← EXISTING ✓

client/src/
├── test/
│   ├── suite/
│   │   ├── extension.test.ts              ← NEW: activation, command registration
│   │   └── documentSymbols.test.ts        ← NEW: outline provider
```

---

## Unit Test Conventions (follow existing pattern)

```typescript
// Use describe/it (not suite/test)
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { MyClass } from './MyClass';

describe('MyClass', () => {
    describe('methodName', () => {
        it('does X when given Y', () => {
            const result = MyClass.methodName('input');
            assert.equal(result, 'expected');
        });
    });
});
```

Key conventions:
- `describe/it` syntax (matches existing file)
- Node's built-in `assert` module (no chai needed)
- Static methods — call directly, no mocking needed
- For classes needing `TextDocument`, use `TextDocument.create(uri, lang, version, content)`
  from `vscode-languageserver-textdocument` — works in plain Node.js without VS Code

---

## Priority Unit Tests to Add

### 1. `validation/DataFlexValidator.test.ts`

Test `validateKeywordCasing()` — highest value, pure function taking a `TextDocument`.

```typescript
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DataFlexValidator } from './DataFlexValidator';

describe('DataFlexValidator', () => {
    describe('validateKeywordCasing', () => {

        it('returns no diagnostics for correctly cased code', () => {
            const doc = TextDocument.create('test://test.src', 'dataflex', 1, 'If (x) Begin\nEnd');
            const diagnostics = DataFlexValidator.validateDocument(doc);
            assert.equal(diagnostics.length, 0);
        });

        it('warns when Begin is lowercase', () => {
            const doc = TextDocument.create('test://test.src', 'dataflex', 1, 'If (x) begin\nEnd');
            const diagnostics = DataFlexValidator.validateDocument(doc);
            assert.equal(diagnostics.length, 1);
            assert.ok(diagnostics[0].message.includes('Begin'));
        });

        it('warns on multiple keywords in one document', () => {
            const doc = TextDocument.create('test://test.src', 'dataflex', 1, 'if (x) begin\nend');
            const diagnostics = DataFlexValidator.validateDocument(doc);
            assert.ok(diagnostics.length >= 2);
        });

    });
});
```

### 2. `Symbols/SymbolIndexBuilder.test.ts`

Test `indexDocument()` scope hierarchy parsing — pure function.

```typescript
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SymbolIndexBuilder } from './SymbolIndexBuilder';

describe('SymbolIndexBuilder', () => {
    describe('indexDocument', () => {

        it('always has a global scope', () => {
            const doc = TextDocument.create('test://x.src', 'dataflex', 1, '');
            const index = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(index.scopes.length, 1);
            assert.equal(index.scopes[0].name, 'global');
        });

        it('detects a Class scope', () => {
            const doc = TextDocument.create('test://x.src', 'dataflex', 1,
                'Class cMyClass is a cObject\nEnd_Class');
            const index = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(index.scopes.length, 2); // global + cMyClass
            assert.equal(index.scopes[1].name, 'cMyClass');
        });

        it('sets endLine when scope closes', () => {
            const doc = TextDocument.create('test://x.src', 'dataflex', 1,
                'Class cFoo is a cObject\nEnd_Class');
            const index = SymbolIndexBuilder.indexDocument(doc);
            const classScope = index.scopes.find(s => s.name === 'cFoo');
            assert.equal(classScope?.endLine, 1);
        });

    });
});
```

### 3. `common/dataflexKeywords.test.ts`

Test keyword regex patterns directly.

```typescript
import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { getAllKeywordRegexes } from './dataflexKeywords';

describe('dataflexKeywords', () => {
    describe('getAllKeywordRegexes', () => {

        it('returns a non-empty array', () => {
            const regexes = getAllKeywordRegexes();
            assert.ok(regexes.length > 0);
        });

        it('each entry has a keyword string and a RegExp', () => {
            const regexes = getAllKeywordRegexes();
            for (const [keyword, regex] of regexes) {
                assert.equal(typeof keyword, 'string');
                assert.ok(regex instanceof RegExp);
            }
        });

    });
});
```

---

## Integration Test Setup (Client)

### Step 1: Add `.vscode-test.json` to repo root

```json
{
  "tests": [
    {
      "workspaceFolder": "${workspaceFolder}/client/test/fixtures",
      "extensionDevelopmentPath": "${workspaceFolder}",
      "files": "client/out/test/suite/**/*.test.js",
      "mocha": { "timeout": 20000 }
    }
  ]
}
```

### Step 2: Create `client/src/test/suite/extension.test.ts`

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';
import { suite, test, suiteSetup } from 'mocha';

suite('Extension Activation', () => {
    suiteSetup(async () => {
        // Wait for extension to activate
        const ext = vscode.extensions.getExtension('KyleMit.dataflex-vscode');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });

    test('extension is active', () => {
        const ext = vscode.extensions.getExtension('KyleMit.dataflex-vscode');
        assert.ok(ext?.isActive, 'Extension should be active');
    });

    test('dataflex language is registered', async () => {
        const langs = await vscode.languages.getLanguages();
        assert.ok(langs.includes('dataflex'), 'dataflex language should be registered');
    });
});
```

### Step 3: Create `client/src/test/suite/documentSymbols.test.ts`

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import { suite, test } from 'mocha';

suite('Document Symbols', () => {
    test('returns symbols for a dataflex document', async () => {
        const fixturePath = path.join(__dirname, '../../../test/fixtures/sample.src');
        const uri = vscode.Uri.file(fixturePath);
        const doc = await vscode.workspace.openTextDocument(uri);

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            doc.uri
        );

        assert.ok(Array.isArray(symbols));
    });
});
```

Note: Create `client/test/fixtures/sample.src` with a simple DataFlex class definition as test data.

---

## Running Tests

```bash
# Unit tests (fast, no VS Code needed)
npm run test:unit

# Integration tests (slow, launches VS Code)
npm test
```

---

## Notes

- `vscode-languageserver-textdocument` is safe to use in unit tests — it does NOT require VS Code
- Integration tests must compile first (`npm run compile`) since `vscode-test` runs `.js` files from `out/`
- The existing `DataflexWorkspaceResolver.test.ts` is the canonical example to follow for style
