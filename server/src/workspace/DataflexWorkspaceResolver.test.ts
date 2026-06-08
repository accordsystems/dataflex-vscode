import { describe, it, beforeEach, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataflexWorkspaceResolver, ResolvedWorkspace, ResolvedSourceDir, SourceKind } from './DataflexWorkspaceResolver';

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

    describe('parseConfigWs', () => {
        const norm = (p: string) => p.replace(/\\/g, '/');

        // Config.ws lives directly in tempDir; Home=. so homeDir = tempDir.
        // All referenced dirs (AppSrc, DDSrc, Programs, etc.) are siblings of Config.ws,
        // which avoids any circular dependency between where Config.ws lives and ProgramPath.
        const SAMPLE_CONFIG = [
            '[Workspace]',
            'Home=.',
            'AppSrcPath=.\\AppSrc',
            'AppHTMLPath=.\\AppHtml',
            'BitmapPath=.\\Bitmaps',
            'IdeSrcPath=.\\IdeSrc',
            'DDSrcPath=.\\DDSrc',
            'HelpPath=.\\Help',
            'ProgramPath=.\\Programs',
            'Description=Test Workspace',
            'DataPath=.\\Data',
            'FileList=.\\Data\\filelist.cfg',
        ].join('\n');

        // Drop a line by key prefix, for building invalid-fixture variants.
        const dropKey = (content: string, key: string) =>
            content.split('\n').filter(l => !l.toLowerCase().startsWith(key.toLowerCase() + '=')).join('\n');

        let tempDir: string;
        let configPath: string;

        function writeFile(relPath: string, content = ''): void {
            const fullPath = path.join(tempDir, relPath.replace(/\\/g, '/'));
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
        }

        // Creates Config.ws and every directory/file it references.
        // Pass skip[] with names from ['AppSrc','AppHtml','Bitmaps','IdeSrc','DDSrc','Help',
        // 'Programs','Data','Data/filelist.cfg'] to omit specific items.
        function writeFixture(opts: { content?: string; skip?: string[] } = {}): void {
            const content = opts.content ?? SAMPLE_CONFIG;
            const skip = opts.skip ?? [];
            writeFile('Config.ws', content);
            for (const dir of ['AppSrc', 'AppHtml', 'Bitmaps', 'IdeSrc', 'DDSrc', 'Help', 'Programs', 'Data']) {
                if (!skip.includes(dir))
                    fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
            }
            if (!skip.includes('Data/filelist.cfg'))
                writeFile('Data/filelist.cfg');
        }

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parseConfigWs-'));
            configPath = path.join(tempDir, 'Config.ws');
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        // --- Happy path (parseConfigWsContent — no disk I/O) ---

        it('stores configPath and resolves homeDir against configDir', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert.equal(norm(result.configPath), norm(configPath));
            assert.equal(norm(result.homeDir), norm(tempDir));
        });

        it('resolves appSrcDirs against homeDir', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert.deepEqual(result.appSrcDirs.map(norm), [norm(path.join(tempDir, 'AppSrc'))]);
        });

        it('resolves ddSrcDirs against homeDir', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert.deepEqual(result.ddSrcDirs.map(norm), [norm(path.join(tempDir, 'DDSrc'))]);
        });

        it('resolves programPath against homeDir', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert.equal(norm(result.programPath), norm(path.join(tempDir, 'Programs')));
        });

        it('resolves filelistPath against homeDir', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert.equal(norm(result.filelistPath), norm(path.join(tempDir, 'Data', 'filelist.cfg')));
        });

        it('stores description', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert.equal(result.description, 'Test Workspace');
        });

        it('returns empty description when key is absent', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'Description'));
            assert.equal(result.description, '');
        });

        it('resolves homeDir one level up when Home=..', () => {
            // Config.ws placed in a subdir so Home=.. resolves back to tempDir
            const subConfigPath = path.join(tempDir, 'Programs', 'Config.ws');
            const subContent = SAMPLE_CONFIG.replace('Home=.', 'Home=..');
            const result = DataflexWorkspaceResolver.parseConfigWsContent(subConfigPath, subContent);
            assert.equal(norm(result.homeDir), norm(tempDir));
        });

        // --- Semicolon expansion ---

        it('expands semicolon-separated AppSrcPath into multiple dirs in order', () => {
            const multiSrc = SAMPLE_CONFIG.replace('AppSrcPath=.\\AppSrc', 'AppSrcPath=.\\AppSrc1;.\\AppSrc2;.\\AppSrc3');
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, multiSrc);
            assert.deepEqual(result.appSrcDirs.map(norm), [
                norm(path.join(tempDir, 'AppSrc1')),
                norm(path.join(tempDir, 'AppSrc2')),
                norm(path.join(tempDir, 'AppSrc3')),
            ]);
        });

        it('filters out trailing semicolons in AppSrcPath', () => {
            const trailing = SAMPLE_CONFIG.replace('AppSrcPath=.\\AppSrc', 'AppSrcPath=.\\AppSrc1;.\\AppSrc2;');
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, trailing);
            assert.equal(result.appSrcDirs.length, 2);
        });

        it('expands semicolon-separated DDSrcPath', () => {
            const multiDd = SAMPLE_CONFIG.replace('DDSrcPath=.\\DDSrc', 'DDSrcPath=.\\DDSrc1;.\\DDSrc2');
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, multiDd);
            assert.equal(result.ddSrcDirs.length, 2);
        });

        // --- Optional fields absent ---

        it('returns empty string for appHTMLDir when AppHTMLPath is absent', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'AppHTMLPath'));
            assert.equal(result.appHTMLDir, '');
        });

        it('returns empty bitmapDirs when BitmapPath is absent', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'BitmapPath'));
            assert.deepEqual(result.bitmapDirs, []);
        });

        it('returns empty ideSrcDirs when IdeSrcPath is absent', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'IdeSrcPath'));
            assert.deepEqual(result.ideSrcDirs, []);
        });

        it('returns empty helpDirs when HelpPath is absent', () => {
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'HelpPath'));
            assert.deepEqual(result.helpDirs, []);
        });

        // --- Absolute DataPath (Windows-only: drive-letter absoluteness only recognized on Win32) ---

        const onWindows = process.platform === 'win32';
        (onWindows ? it : it.skip)('absolute DataPath is not re-resolved against homeDir', () => {
            const absData = SAMPLE_CONFIG.replace('DataPath=.\\Data', 'DataPath=D:\\absolute\\data');
            const result = DataflexWorkspaceResolver.parseConfigWsContent(configPath, absData);
            assert.equal(norm(result.dataDirs[0]!), 'D:/absolute/data');
        });

        // --- Validation failures (structure — parseConfigWsContent, no disk needed) ---

        it('throws when [Workspace] section is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, '[Other]\nkey=val'));
        });

        it('throws when Home key is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'Home')));
        });

        it('throws when AppSrcPath key is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'AppSrcPath')));
        });

        it('throws when DDSrcPath key is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'DDSrcPath')));
        });

        it('throws when ProgramPath key is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'ProgramPath')));
        });

        it('throws when DataPath key is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'DataPath')));
        });

        it('throws when FileList key is missing', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'FileList')));
        });

        // --- Disk existence (parseConfigWs) ---

        it('throws when Config.ws file does not exist', () => {
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(path.join(tempDir, 'missing.ws')));
        });

        it('parses a fully-valid Config.ws end-to-end', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver.parseConfigWs(configPath);
            assert.equal(norm(result.homeDir), norm(tempDir));
            assert.equal(result.appSrcDirs.length, 1);
            assert.equal(result.ddSrcDirs.length, 1);
        });

        it('throws when homeDir does not exist on disk', () => {
            const badHome = SAMPLE_CONFIG.replace('Home=.', 'Home=.\\nonexistent-home');
            writeFixture({ content: badHome });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('throws when an appSrcDir does not exist on disk', () => {
            writeFixture({ skip: ['AppSrc'] });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('throws when a ddSrcDir does not exist on disk', () => {
            writeFixture({ skip: ['DDSrc'] });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('throws when programPath does not exist on disk', () => {
            writeFixture({ skip: ['Programs'] });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('throws when a dataDir does not exist on disk', () => {
            // Also skip the filelist file so writeFile does not auto-create the Data dir
            writeFixture({ skip: ['Data', 'Data/filelist.cfg'] });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('throws when filelistPath does not exist on disk', () => {
            writeFixture({ skip: ['Data/filelist.cfg'] });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('does not throw when AppHTMLPath is absent (optional)', () => {
            writeFixture({ content: dropKey(SAMPLE_CONFIG, 'AppHTMLPath'), skip: ['AppHtml'] });
            assert.doesNotThrow(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });

        it('throws when AppHTMLPath is set but directory does not exist', () => {
            writeFixture({ skip: ['AppHtml'] });
            assert.throws(() => DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
    });

    describe('resolve', () => {
        const norm = (p: string) => p.replace(/\\/g, '/');
        let tempDir: string;

        // Creates a minimal but fully valid DataFlex workspace at wsDir.
        // Returns the absolute path to the .sws file.
        // libPaths: absolute paths to library .sws files to reference in [Libraries].
        function buildWorkspace(wsDir: string, opts: {
            name?: string;
            version?: string;
            libPaths?: string[];
        } = {}): string {
            const { name = 'workspace', version = '19.1', libPaths = [] } = opts;
            for (const dir of ['AppSrc', 'DDSrc', 'Programs', 'Data']) {
                fs.mkdirSync(path.join(wsDir, dir), { recursive: true });
            }
            fs.writeFileSync(path.join(wsDir, 'Data', 'filelist.cfg'), '');
            fs.writeFileSync(path.join(wsDir, 'Main.src'), '');

            const configContent = [
                '[Workspace]',
                'Home=..',
                'AppSrcPath=.\\AppSrc',
                'DDSrcPath=.\\DDSrc',
                'ProgramPath=.\\Programs',
                'DataPath=.\\Data',
                'FileList=.\\Data\\filelist.cfg',
            ].join('\n');
            fs.writeFileSync(path.join(wsDir, 'Programs', 'Config.ws'), configContent);

            const libEntries = libPaths.map((absLibPath, i) => {
                const rel = path.relative(wsDir, absLibPath).replace(/\//g, '\\');
                return `Lib${i}=${rel}`;
            });
            const swsLines = [
                '[Properties]',
                `Version=${version}`,
                '[WorkspacePaths]',
                'ConfigFile=.\\Programs\\Config.ws',
                '[Projects]',
                'Project0=Main.src',
                ...(libEntries.length > 0 ? ['[Libraries]', ...libEntries] : []),
                '',
            ];
            const swsFilePath = path.join(wsDir, `${name}.sws`);
            fs.writeFileSync(swsFilePath, swsLines.join('\n'));
            return swsFilePath;
        }

        beforeEach(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-'));
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('resolves a simple workspace with no libraries', () => {
            const swsPath = buildWorkspace(path.join(tempDir, 'main'));
            const result = DataflexWorkspaceResolver.resolve(swsPath);
            assert.equal(result.version, '19.1');
            assert.equal(norm(result.swsPath), norm(swsPath));
            assert.equal(result.libraries.length, 0);
        });

        it('sourceDirs contains appSrc and ddSrc entries at depth 0 with correct swsOrigin', () => {
            const swsPath = buildWorkspace(path.join(tempDir, 'main'));
            const result = DataflexWorkspaceResolver.resolve(swsPath);
            const appSrc = result.sourceDirs.filter(d => d.kind === 'appSrc');
            const ddSrc  = result.sourceDirs.filter(d => d.kind === 'ddSrc');
            assert.equal(appSrc.length, 1);
            assert.equal(ddSrc.length, 1);
            assert.ok(result.sourceDirs.every(d => d.depth === 0));
            assert.ok(result.sourceDirs.every(d => norm(d.swsOrigin) === norm(swsPath)));
        });

        it('resolves a workspace with one library — library sourceDirs have depth 1', () => {
            const libSws  = buildWorkspace(path.join(tempDir, 'lib'),  { name: 'lib' });
            const mainSws = buildWorkspace(path.join(tempDir, 'main'), { libPaths: [libSws] });
            const result = DataflexWorkspaceResolver.resolve(mainSws);
            assert.equal(result.libraries.length, 1);
            assert.ok(result.libraries[0]!.sourceDirs.every(d => d.depth === 1));
        });

        it('resolves a diamond dependency (two parents share one library) without throwing', () => {
            const sharedSws = buildWorkspace(path.join(tempDir, 'shared'), { name: 'shared' });
            const libASws   = buildWorkspace(path.join(tempDir, 'libA'),   { name: 'libA', libPaths: [sharedSws] });
            const libBSws   = buildWorkspace(path.join(tempDir, 'libB'),   { name: 'libB', libPaths: [sharedSws] });
            const mainSws   = buildWorkspace(path.join(tempDir, 'main'),   { libPaths: [libASws, libBSws] });
            assert.doesNotThrow(() => DataflexWorkspaceResolver.resolve(mainSws));
        });

        it('throws on a cyclic library reference', () => {
            // Build libB first (no libs), then libA referencing libB.
            // Patch libB.sws to back-reference libA, creating the cycle A→B→A.
            const libADir = path.join(tempDir, 'libA');
            const libBDir = path.join(tempDir, 'libB');
            const libBSws = buildWorkspace(libBDir, { name: 'libB' });
            const libASws = buildWorkspace(libADir, { name: 'libA', libPaths: [libBSws] });
            const libARelFromLibB = path.relative(libBDir, libASws).replace(/\//g, '\\');
            fs.writeFileSync(libBSws, [
                '[Properties]', 'Version=19.1',
                '[WorkspacePaths]', 'ConfigFile=.\\Programs\\Config.ws',
                '[Projects]', 'Project0=Main.src',
                '[Libraries]', `Lib0=${libARelFromLibB}`,
                '',
            ].join('\n'));
            const mainSws = buildWorkspace(path.join(tempDir, 'main'), { libPaths: [libASws] });
            assert.throws(() => DataflexWorkspaceResolver.resolve(mainSws), /cyclic/i);
        });

        it('throws when a referenced library sws file does not exist', () => {
            const nonexistentLib = path.join(tempDir, 'missing', 'missing.sws');
            const mainSws = buildWorkspace(path.join(tempDir, 'main'), { libPaths: [nonexistentLib] });
            assert.throws(() => DataflexWorkspaceResolver.resolve(mainSws));
        });
    });

    describe('flattenSourceDirs', () => {
        function makeDir(absolutePath: string, kind: SourceKind, swsOrigin = 'ws.sws', depth = 0): ResolvedSourceDir {
            return { absolutePath, kind, swsOrigin, depth };
        }
        function makeWs(sourceDirs: ResolvedSourceDir[], libraries: ResolvedWorkspace[] = []): ResolvedWorkspace {
            return { swsPath: 'ws.sws', version: '19.1', conditionals: {}, sourceDirs, config: {} as any, libraries };
        }

        it('returns all source dirs for a workspace with no libraries', () => {
            const ws = makeWs([makeDir('/app/AppSrc', 'appSrc'), makeDir('/app/DDSrc', 'ddSrc')]);
            assert.equal(DataflexWorkspaceResolver.flattenSourceDirs(ws).length, 2);
        });

        it('main workspace dirs appear before library dirs', () => {
            const lib  = makeWs([makeDir('/lib/AppSrc',  'appSrc', 'lib.sws', 1)]);
            const main = makeWs([makeDir('/main/AppSrc', 'appSrc')], [lib]);
            const result = DataflexWorkspaceResolver.flattenSourceDirs(main);
            assert.equal(result[0]!.absolutePath, '/main/AppSrc');
            assert.equal(result[1]!.absolutePath, '/lib/AppSrc');
        });

        it('deduplicates a shared directory — first occurrence (main) wins', () => {
            const shared = '/shared/AppSrc';
            const lib  = makeWs([makeDir(shared, 'appSrc', 'lib.sws', 1)]);
            const main = makeWs([makeDir(shared, 'appSrc')], [lib]);
            const result = DataflexWorkspaceResolver.flattenSourceDirs(main);
            assert.equal(result.length, 1);
            assert.equal(result[0]!.depth, 0);
        });

        it('deduplication is case-insensitive', () => {
            const lib  = makeWs([makeDir('C:\\App\\APPSRC', 'appSrc', 'lib.sws', 1)]);
            const main = makeWs([makeDir('C:\\App\\AppSrc', 'appSrc')], [lib]);
            assert.equal(DataflexWorkspaceResolver.flattenSourceDirs(main).length, 1);
        });

        it('flattens a two-level library tree in depth-first order', () => {
            const lib2 = makeWs([makeDir('/lib2/AppSrc', 'appSrc', 'lib2.sws', 2)]);
            const lib1 = makeWs([makeDir('/lib1/AppSrc', 'appSrc', 'lib1.sws', 1)], [lib2]);
            const main = makeWs([makeDir('/main/AppSrc', 'appSrc')], [lib1]);
            const result = DataflexWorkspaceResolver.flattenSourceDirs(main);
            assert.deepEqual(result.map(d => d.absolutePath), ['/main/AppSrc', '/lib1/AppSrc', '/lib2/AppSrc']);
        });
    });

    describe('getAppSrcPaths and getDdSrcPaths', () => {
        const ws: ResolvedWorkspace = {
            swsPath: 'ws.sws', version: '19.1', conditionals: {},
            config: {} as any, libraries: [],
            sourceDirs: [
                { absolutePath: '/app/AppSrc',  kind: 'appSrc', swsOrigin: 'ws.sws', depth: 0 },
                { absolutePath: '/app/DDSrc',   kind: 'ddSrc',  swsOrigin: 'ws.sws', depth: 0 },
                { absolutePath: '/app/DDSrc2',  kind: 'ddSrc',  swsOrigin: 'ws.sws', depth: 0 },
            ],
        };

        it('getAppSrcPaths returns only appSrc absolute paths', () => {
            assert.deepEqual(DataflexWorkspaceResolver.getAppSrcPaths(ws), ['/app/AppSrc']);
        });

        it('getDdSrcPaths returns only ddSrc absolute paths', () => {
            assert.deepEqual(DataflexWorkspaceResolver.getDdSrcPaths(ws), ['/app/DDSrc', '/app/DDSrc2']);
        });
    });
});
