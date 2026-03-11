import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { DataflexWorkspaceResolver } from './DataflexWorkspaceResolver';

describe('DataflexWorkspaceResolver', () => {
    describe('parseIni', () => {

        it('parses a simple section and key', () => {
            const result = DataflexWorkspaceResolver.parseIni('[Section]\nkey=value');
            assert.equal(result['section']?.['key'], 'value');
        });

        it('is case insensitive for section names and keys', () => {
            const result = DataflexWorkspaceResolver.parseIni('[MySection]\nMyKey=value');
            assert.equal(result['mysection']?.['mykey'], 'value');
        });

        it('ignores comment lines starting with ;', () => {
            const result = DataflexWorkspaceResolver.parseIni('; comment\n[Section]\nkey=value');
            assert.equal(Object.keys(result).length, 1);
        });

        it('ignores comment lines starting with #', () => {
            const result = DataflexWorkspaceResolver.parseIni('# comment\n[Section]\nkey=value');
            assert.equal(Object.keys(result).length, 1);
        });

        it('ignores empty lines', () => {
            const result = DataflexWorkspaceResolver.parseIni('\n[Section]\n\nkey=value\n');
            assert.equal(result['section']?.['key'], 'value');
        });

        it('value containing = uses only the first = as separator', () => {
            const result = DataflexWorkspaceResolver.parseIni('[Section]\nkey=a=b=c');
            assert.equal(result['section']?.['key'], 'a=b=c');
        });

        it('last value wins when key is defined multiple times', () => {
            const result = DataflexWorkspaceResolver.parseIni('[Section]\nkey=first\nkey=second');
            assert.equal(result['section']?.['key'], 'second');
        });

        it('supports \\r\\n line endings', () => {
            const result = DataflexWorkspaceResolver.parseIni('[Section]\r\nkey=value\r\n');
            assert.equal(result['section']?.['key'], 'value');
        });

        it('trims whitespace around section names', () => {
            const result = DataflexWorkspaceResolver.parseIni('[ Section ]\nkey=value');
            assert.equal(result['section']?.['key'], 'value');
        });

        it('trims whitespace around keys and values', () => {
            const result = DataflexWorkspaceResolver.parseIni('[Section]\n  key  =  value  ');
            assert.equal(result['section']?.['mykey'], undefined);
            assert.equal(result['section']?.['key'], 'value');
        });

        it('throws on key=value before any section header', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseIni('key=value'));
        });

        it('returns empty object for empty input', () => {
            const result = DataflexWorkspaceResolver.parseIni('');
            assert.equal(Object.keys(result).length, 0);
        });

    });
});
