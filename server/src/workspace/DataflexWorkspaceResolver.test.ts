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

    describe('resolvePath', () => {
        // path.resolve returns backslashes on Windows and forward slashes on POSIX.
        // Tests assert on the forward-slash form and normalize the actual result, so the
        // same assertions pass on both platforms.
        const norm = (p: string) => p.replace(/\\/g, '/');

        it('resolves a relative path with backslashes', () => {
            const result = DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '.\\sub\\file');
            assert.equal(norm(result), 'C:/a/b/sub/file');
        });

        it('resolves a relative path with forward slashes', () => {
            const result = DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', './sub/file');
            assert.equal(norm(result), 'C:/a/b/sub/file');
        });

        it('resolves a relative path with mixed separators', () => {
            const result = DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '.\\sub/file');
            assert.equal(norm(result), 'C:/a/b/sub/file');
        });

        it('collapses .. segments', () => {
            const result = DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '..\\c');
            assert.equal(norm(result), 'C:/a/c');
        });

        it('collapses repeated . segments', () => {
            const result = DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '.\\.\\.\\file');
            assert.equal(norm(result), 'C:/a/b/file');
        });

        it('throws on empty relativePath', () => {
            assert.throws(() => DataflexWorkspaceResolver.resolveRelativePath('C:/a', ''));
        });

        it('throws on whitespace-only relativePath', () => {
            assert.throws(() => DataflexWorkspaceResolver.resolveRelativePath('C:/a', '   '));
        });

        // Drive-letter absoluteness is recognized by path.win32 but not path.posix,
        // so this assertion is only meaningful on Windows. it.skip leaves the case
        // visible in the report on other platforms instead of silently dropping it.
        const onWindows = process.platform === 'win32';
        (onWindows ? it : it.skip)('returns an absolute Windows path unchanged (ignores baseDir)', () => {
            const result = DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', 'D:\\env\\dat');
            assert.equal(norm(result), 'D:/env/dat');
        });
    });
});
