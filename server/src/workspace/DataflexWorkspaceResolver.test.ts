import { describe, it, beforeEach, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

    describe('parseSws', () => {
        // The sample INI from the comment block at the top of DataflexWorkspaceResolver.ts,
        // reproduced here verbatim. Backslashes are doubled because this is a TS string literal;
        // the on-disk content has single backslashes (Windows style).
        const SAMPLE_SWS = [
            '[Properties]',
            'Version=19.1',
            '[WorkspacePaths]',
            'ConfigFile=.\\Programs\\Config.ws',
            '[Preferences]',
            'DefaultFormHeight=12',
            '[Conditionals]',
            'Is$WebApp=True',
            '[Libraries]',
            'Lib2=libs\\libi20\\asgI20-191.sws',
            'Lib1=libs\\DataFlex DateTime Library 24.0\\DateTime - 191.sws',
            'Lib3=libs\\DataFlex Conversions Library 24.0\\Conversions - 191.sws',
            '[Projects]',
            'Project0=WebApp.src',
            'Project1=CarmTests.src',
            '',
        ].join('\n');

        const SAMPLE_LIBRARIES = [
            'libs/libi20/asgI20-191.sws',
            'libs/DataFlex DateTime Library 24.0/DateTime - 191.sws',
            'libs/DataFlex Conversions Library 24.0/Conversions - 191.sws',
        ];
        const SAMPLE_PROJECTS = ['WebApp.src', 'CarmTests.src'];

        const norm = (p: string) => p.replace(/\\/g, '/');

        let tempDir: string;
        let swsPath: string;

        // Create a file at relPath under tempDir, making parent directories as needed.
        function writeFile(relPath: string, content = ''): void {
            const fullPath = path.join(tempDir, relPath.replace(/\\/g, '/'));
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
        }

        // Lay down a complete, valid fixture: the SWS file and every supporting file it
        // references (Config.ws, project .src files, library .sws files). Individual tests
        // override pieces by passing flags — e.g. `configWs: false` to test the "missing
        // config file" path.
        function writeFixture(opts: {
            swsContent?: string;
            configWs?: boolean;
            projects?: string[];
            libraries?: string[];
        } = {}): void {
            const {
                swsContent = SAMPLE_SWS,
                configWs = true,
                projects = SAMPLE_PROJECTS,
                libraries = SAMPLE_LIBRARIES,
            } = opts;

            writeFile('test.sws', swsContent);
            if (configWs) writeFile('Programs/Config.ws');
            for (const p of projects) writeFile(p);
            for (const l of libraries) writeFile(l);
        }

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parseSws-'));
            swsPath = path.join(tempDir, 'test.sws');
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        // --- Happy path ---

        it('parses a valid SWS file with all sections', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            assert.equal(result.version, '19.1');
            assert.equal(result.swsPath, swsPath);
            assert.equal(norm(result.swsDir), norm(tempDir));
        });

        it('preserves library order from the source file (Lib2 before Lib1 before Lib3)', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            const expected = SAMPLE_LIBRARIES.map(rel => norm(path.join(tempDir, rel)));
            assert.deepEqual(result.librarySwsPaths.map(norm), expected);
        });

        it('resolves library paths to absolute against swsDir', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            for (const libPath of result.librarySwsPaths) {
                assert.ok(path.isAbsolute(libPath), `expected absolute path, got: ${libPath}`);
            }
        });

        it('resolves configFilePath to absolute against swsDir', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            assert.equal(
                norm(result.configFilePath),
                norm(path.join(tempDir, 'Programs', 'Config.ws')),
            );
        });

        it('returns conditionals as-is (keys lowercased by parseIni, values preserved)', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            assert.equal(result.conditionals['is$webapp'], 'True');
        });

        // --- Optional sections ---

        it('returns empty librarySwsPaths when [Libraries] section is absent', () => {
            const noLibs = SAMPLE_SWS.replace(/\[Libraries\][^[]*/, '');
            writeFixture({ swsContent: noLibs, libraries: [] });
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            assert.deepEqual(result.librarySwsPaths, []);
        });

        it('returns empty conditionals when [Conditionals] section is absent', () => {
            const noConds = SAMPLE_SWS.replace(/\[Conditionals\][^[]*/, '');
            writeFixture({ swsContent: noConds });
            const result = DataflexWorkspaceResolver.parseSws(swsPath);

            assert.deepEqual(result.conditionals, {});
        });

        // --- Validation failures ---

        it('throws when the SWS file does not exist on disk', () => {
            // Don't write any fixture — the SWS path itself is missing.
            const nonexistent = path.join(tempDir, 'does-not-exist.sws');
            assert.throws(() => DataflexWorkspaceResolver.parseSws(nonexistent));
        });

        it('throws when [Properties] section is missing', () => {
            const noProps = SAMPLE_SWS.replace(/\[Properties\][^[]*/, '');
            writeFixture({ swsContent: noProps });
            assert.throws(() => DataflexWorkspaceResolver.parseSws(swsPath));
        });

        it('throws when [WorkspacePaths] section is missing', () => {
            const noWsp = SAMPLE_SWS.replace(/\[WorkspacePaths\][^[]*/, '');
            writeFixture({ swsContent: noWsp });
            assert.throws(() => DataflexWorkspaceResolver.parseSws(swsPath));
        });

        it('throws when [Projects] section is missing', () => {
            const noProj = SAMPLE_SWS.replace(/\[Projects\][^[]*/, '');
            writeFixture({ swsContent: noProj });
            assert.throws(() => DataflexWorkspaceResolver.parseSws(swsPath));
        });

        it('throws when [Projects] section is empty', () => {
            const emptyProj = SAMPLE_SWS.replace(/\[Projects\][^[]*/, '[Projects]\n');
            writeFixture({ swsContent: emptyProj, projects: [] });
            assert.throws(() => DataflexWorkspaceResolver.parseSws(swsPath));
        });

        it('throws when the config file referenced by [WorkspacePaths] does not exist on disk', () => {
            writeFixture({ configWs: false });
            assert.throws(() => DataflexWorkspaceResolver.parseSws(swsPath));
        });
    });
});
