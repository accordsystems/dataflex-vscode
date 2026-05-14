"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const assert_1 = require("assert");
const DataflexWorkspaceResolver_1 = require("./DataflexWorkspaceResolver");
(0, mocha_1.describe)('DataflexWorkspaceResolver', () => {
    (0, mocha_1.describe)('parseIni', () => {
        (0, mocha_1.it)('parses a simple section and key', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[Section]\nkey=value');
            assert_1.strict.equal(result['section']?.['key'], 'value');
        });
        (0, mocha_1.it)('is case insensitive for section names and keys', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[MySection]\nMyKey=value');
            assert_1.strict.equal(result['mysection']?.['mykey'], 'value');
        });
        (0, mocha_1.it)('ignores comment lines starting with ;', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('; comment\n[Section]\nkey=value');
            assert_1.strict.equal(Object.keys(result).length, 1);
        });
        (0, mocha_1.it)('ignores comment lines starting with #', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('# comment\n[Section]\nkey=value');
            assert_1.strict.equal(Object.keys(result).length, 1);
        });
        (0, mocha_1.it)('ignores empty lines', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('\n[Section]\n\nkey=value\n');
            assert_1.strict.equal(result['section']?.['key'], 'value');
        });
        (0, mocha_1.it)('value containing = uses only the first = as separator', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[Section]\nkey=a=b=c');
            assert_1.strict.equal(result['section']?.['key'], 'a=b=c');
        });
        (0, mocha_1.it)('last value wins when key is defined multiple times', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[Section]\nkey=first\nkey=second');
            assert_1.strict.equal(result['section']?.['key'], 'second');
        });
        (0, mocha_1.it)('supports \\r\\n line endings', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[Section]\r\nkey=value\r\n');
            assert_1.strict.equal(result['section']?.['key'], 'value');
        });
        (0, mocha_1.it)('trims whitespace around section names', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[ Section ]\nkey=value');
            assert_1.strict.equal(result['section']?.['key'], 'value');
        });
        (0, mocha_1.it)('trims whitespace around keys and values', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('[Section]\n  key  =  value  ');
            assert_1.strict.equal(result['section']?.['mykey'], undefined);
            assert_1.strict.equal(result['section']?.['key'], 'value');
        });
        (0, mocha_1.it)('throws on key=value before any section header', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('key=value'));
        });
        (0, mocha_1.it)('returns empty object for empty input', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseIni('');
            assert_1.strict.equal(Object.keys(result).length, 0);
        });
    });
});
//# sourceMappingURL=DataflexWorkspaceResolver.test.js.map