"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const assert_1 = require("assert");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
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
    (0, mocha_1.describe)('resolvePath', () => {
        // path.resolve returns backslashes on Windows and forward slashes on POSIX.
        // Tests assert on the forward-slash form and normalize the actual result, so the
        // same assertions pass on both platforms.
        const norm = (p) => p.replace(/\\/g, '/');
        (0, mocha_1.it)('resolves a relative path with backslashes', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '.\\sub\\file');
            assert_1.strict.equal(norm(result), 'C:/a/b/sub/file');
        });
        (0, mocha_1.it)('resolves a relative path with forward slashes', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', './sub/file');
            assert_1.strict.equal(norm(result), 'C:/a/b/sub/file');
        });
        (0, mocha_1.it)('resolves a relative path with mixed separators', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '.\\sub/file');
            assert_1.strict.equal(norm(result), 'C:/a/b/sub/file');
        });
        (0, mocha_1.it)('collapses .. segments', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '..\\c');
            assert_1.strict.equal(norm(result), 'C:/a/c');
        });
        (0, mocha_1.it)('collapses repeated . segments', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', '.\\.\\.\\file');
            assert_1.strict.equal(norm(result), 'C:/a/b/file');
        });
        (0, mocha_1.it)('throws on empty relativePath', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a', ''));
        });
        (0, mocha_1.it)('throws on whitespace-only relativePath', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a', '   '));
        });
        // Drive-letter absoluteness is recognized by path.win32 but not path.posix,
        // so this assertion is only meaningful on Windows. it.skip leaves the case
        // visible in the report on other platforms instead of silently dropping it.
        const onWindows = process.platform === 'win32';
        (onWindows ? mocha_1.it : mocha_1.it.skip)('returns an absolute Windows path unchanged (ignores baseDir)', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.resolveRelativePath('C:/a/b', 'D:\\env\\dat');
            assert_1.strict.equal(norm(result), 'D:/env/dat');
        });
    });
    (0, mocha_1.describe)('parseSws', () => {
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
        const norm = (p) => p.replace(/\\/g, '/');
        let tempDir;
        let swsPath;
        // Create a file at relPath under tempDir, making parent directories as needed.
        function writeFile(relPath, content = '') {
            const fullPath = path.join(tempDir, relPath.replace(/\\/g, '/'));
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
        }
        // Lay down a complete, valid fixture: the SWS file and every supporting file it
        // references (Config.ws, project .src files, library .sws files). Individual tests
        // override pieces by passing flags — e.g. `configWs: false` to test the "missing
        // config file" path.
        function writeFixture(opts = {}) {
            const { swsContent = SAMPLE_SWS, configWs = true, projects = SAMPLE_PROJECTS, libraries = SAMPLE_LIBRARIES, } = opts;
            writeFile('test.sws', swsContent);
            if (configWs)
                writeFile('Programs/Config.ws');
            for (const p of projects)
                writeFile(p);
            for (const l of libraries)
                writeFile(l);
        }
        (0, mocha_1.beforeEach)(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parseSws-'));
            swsPath = path.join(tempDir, 'test.sws');
        });
        (0, mocha_1.afterEach)(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });
        // --- Happy path ---
        (0, mocha_1.it)('parses a valid SWS file with all sections', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            assert_1.strict.equal(result.version, '19.1');
            assert_1.strict.equal(result.swsPath, swsPath);
            assert_1.strict.equal(norm(result.swsDir), norm(tempDir));
        });
        (0, mocha_1.it)('preserves library order from the source file (Lib2 before Lib1 before Lib3)', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            const expected = SAMPLE_LIBRARIES.map(rel => norm(path.join(tempDir, rel)));
            assert_1.strict.deepEqual(result.librarySwsPaths.map(norm), expected);
        });
        (0, mocha_1.it)('resolves library paths to absolute against swsDir', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            for (const libPath of result.librarySwsPaths) {
                assert_1.strict.ok(path.isAbsolute(libPath), `expected absolute path, got: ${libPath}`);
            }
        });
        (0, mocha_1.it)('resolves configFilePath to absolute against swsDir', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            assert_1.strict.equal(norm(result.configFilePath), norm(path.join(tempDir, 'Programs', 'Config.ws')));
        });
        (0, mocha_1.it)('returns conditionals as-is (keys lowercased by parseIni, values preserved)', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            assert_1.strict.equal(result.conditionals['is$webapp'], 'True');
        });
        // --- Optional sections ---
        (0, mocha_1.it)('returns empty librarySwsPaths when [Libraries] section is absent', () => {
            const noLibs = SAMPLE_SWS.replace(/\[Libraries\][^[]*/, '');
            writeFixture({ swsContent: noLibs, libraries: [] });
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            assert_1.strict.deepEqual(result.librarySwsPaths, []);
        });
        (0, mocha_1.it)('returns empty conditionals when [Conditionals] section is absent', () => {
            const noConds = SAMPLE_SWS.replace(/\[Conditionals\][^[]*/, '');
            writeFixture({ swsContent: noConds });
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath);
            assert_1.strict.deepEqual(result.conditionals, {});
        });
        // --- Validation failures ---
        (0, mocha_1.it)('throws when the SWS file does not exist on disk', () => {
            // Don't write any fixture — the SWS path itself is missing.
            const nonexistent = path.join(tempDir, 'does-not-exist.sws');
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(nonexistent));
        });
        (0, mocha_1.it)('throws when [Properties] section is missing', () => {
            const noProps = SAMPLE_SWS.replace(/\[Properties\][^[]*/, '');
            writeFixture({ swsContent: noProps });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath));
        });
        (0, mocha_1.it)('throws when [WorkspacePaths] section is missing', () => {
            const noWsp = SAMPLE_SWS.replace(/\[WorkspacePaths\][^[]*/, '');
            writeFixture({ swsContent: noWsp });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath));
        });
        (0, mocha_1.it)('throws when [Projects] section is missing', () => {
            const noProj = SAMPLE_SWS.replace(/\[Projects\][^[]*/, '');
            writeFixture({ swsContent: noProj });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath));
        });
        (0, mocha_1.it)('throws when [Projects] section is empty', () => {
            const emptyProj = SAMPLE_SWS.replace(/\[Projects\][^[]*/, '[Projects]\n');
            writeFixture({ swsContent: emptyProj, projects: [] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath));
        });
        (0, mocha_1.it)('throws when the config file referenced by [WorkspacePaths] does not exist on disk', () => {
            writeFixture({ configWs: false });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseSws(swsPath));
        });
    });
    (0, mocha_1.describe)('parseConfigWs', () => {
        const norm = (p) => p.replace(/\\/g, '/');
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
        const dropKey = (content, key) => content.split('\n').filter(l => !l.toLowerCase().startsWith(key.toLowerCase() + '=')).join('\n');
        let tempDir;
        let configPath;
        function writeFile(relPath, content = '') {
            const fullPath = path.join(tempDir, relPath.replace(/\\/g, '/'));
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
        }
        // Creates Config.ws and every directory/file it references.
        // Pass skip[] with names from ['AppSrc','AppHtml','Bitmaps','IdeSrc','DDSrc','Help',
        // 'Programs','Data','Data/filelist.cfg'] to omit specific items.
        function writeFixture(opts = {}) {
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
        (0, mocha_1.beforeEach)(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parseConfigWs-'));
            configPath = path.join(tempDir, 'Config.ws');
        });
        (0, mocha_1.afterEach)(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });
        // --- Happy path (parseConfigWsContent — no disk I/O) ---
        (0, mocha_1.it)('stores configPath and resolves homeDir against configDir', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert_1.strict.equal(norm(result.configPath), norm(configPath));
            assert_1.strict.equal(norm(result.homeDir), norm(tempDir));
        });
        (0, mocha_1.it)('resolves appSrcDirs against homeDir', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert_1.strict.deepEqual(result.appSrcDirs.map(norm), [norm(path.join(tempDir, 'AppSrc'))]);
        });
        (0, mocha_1.it)('resolves ddSrcDirs against homeDir', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert_1.strict.deepEqual(result.ddSrcDirs.map(norm), [norm(path.join(tempDir, 'DDSrc'))]);
        });
        (0, mocha_1.it)('resolves programPath against homeDir', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert_1.strict.equal(norm(result.programPath), norm(path.join(tempDir, 'Programs')));
        });
        (0, mocha_1.it)('resolves filelistPath against homeDir', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert_1.strict.equal(norm(result.filelistPath), norm(path.join(tempDir, 'Data', 'filelist.cfg')));
        });
        (0, mocha_1.it)('stores description', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, SAMPLE_CONFIG);
            assert_1.strict.equal(result.description, 'Test Workspace');
        });
        (0, mocha_1.it)('returns empty description when key is absent', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'Description'));
            assert_1.strict.equal(result.description, '');
        });
        (0, mocha_1.it)('resolves homeDir one level up when Home=..', () => {
            // Config.ws placed in a subdir so Home=.. resolves back to tempDir
            const subConfigPath = path.join(tempDir, 'Programs', 'Config.ws');
            const subContent = SAMPLE_CONFIG.replace('Home=.', 'Home=..');
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(subConfigPath, subContent);
            assert_1.strict.equal(norm(result.homeDir), norm(tempDir));
        });
        // --- Semicolon expansion ---
        (0, mocha_1.it)('expands semicolon-separated AppSrcPath into multiple dirs in order', () => {
            const multiSrc = SAMPLE_CONFIG.replace('AppSrcPath=.\\AppSrc', 'AppSrcPath=.\\AppSrc1;.\\AppSrc2;.\\AppSrc3');
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, multiSrc);
            assert_1.strict.deepEqual(result.appSrcDirs.map(norm), [
                norm(path.join(tempDir, 'AppSrc1')),
                norm(path.join(tempDir, 'AppSrc2')),
                norm(path.join(tempDir, 'AppSrc3')),
            ]);
        });
        (0, mocha_1.it)('filters out trailing semicolons in AppSrcPath', () => {
            const trailing = SAMPLE_CONFIG.replace('AppSrcPath=.\\AppSrc', 'AppSrcPath=.\\AppSrc1;.\\AppSrc2;');
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, trailing);
            assert_1.strict.equal(result.appSrcDirs.length, 2);
        });
        (0, mocha_1.it)('expands semicolon-separated DDSrcPath', () => {
            const multiDd = SAMPLE_CONFIG.replace('DDSrcPath=.\\DDSrc', 'DDSrcPath=.\\DDSrc1;.\\DDSrc2');
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, multiDd);
            assert_1.strict.equal(result.ddSrcDirs.length, 2);
        });
        // --- Optional fields absent ---
        (0, mocha_1.it)('returns empty string for appHTMLDir when AppHTMLPath is absent', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'AppHTMLPath'));
            assert_1.strict.equal(result.appHTMLDir, '');
        });
        (0, mocha_1.it)('returns empty bitmapDirs when BitmapPath is absent', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'BitmapPath'));
            assert_1.strict.deepEqual(result.bitmapDirs, []);
        });
        (0, mocha_1.it)('returns empty ideSrcDirs when IdeSrcPath is absent', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'IdeSrcPath'));
            assert_1.strict.deepEqual(result.ideSrcDirs, []);
        });
        (0, mocha_1.it)('returns empty helpDirs when HelpPath is absent', () => {
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'HelpPath'));
            assert_1.strict.deepEqual(result.helpDirs, []);
        });
        // --- Absolute DataPath (Windows-only: drive-letter absoluteness only recognized on Win32) ---
        const onWindows = process.platform === 'win32';
        (onWindows ? mocha_1.it : mocha_1.it.skip)('absolute DataPath is not re-resolved against homeDir', () => {
            const absData = SAMPLE_CONFIG.replace('DataPath=.\\Data', 'DataPath=D:\\absolute\\data');
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, absData);
            assert_1.strict.equal(norm(result.dataDirs[0]), 'D:/absolute/data');
        });
        // --- Validation failures (structure — parseConfigWsContent, no disk needed) ---
        (0, mocha_1.it)('throws when [Workspace] section is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, '[Other]\nkey=val'));
        });
        (0, mocha_1.it)('throws when Home key is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'Home')));
        });
        (0, mocha_1.it)('throws when AppSrcPath key is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'AppSrcPath')));
        });
        (0, mocha_1.it)('throws when DDSrcPath key is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'DDSrcPath')));
        });
        (0, mocha_1.it)('throws when ProgramPath key is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'ProgramPath')));
        });
        (0, mocha_1.it)('throws when DataPath key is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'DataPath')));
        });
        (0, mocha_1.it)('throws when FileList key is missing', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWsContent(configPath, dropKey(SAMPLE_CONFIG, 'FileList')));
        });
        // --- Disk existence (parseConfigWs) ---
        (0, mocha_1.it)('throws when Config.ws file does not exist', () => {
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(path.join(tempDir, 'missing.ws')));
        });
        (0, mocha_1.it)('parses a fully-valid Config.ws end-to-end', () => {
            writeFixture();
            const result = DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath);
            assert_1.strict.equal(norm(result.homeDir), norm(tempDir));
            assert_1.strict.equal(result.appSrcDirs.length, 1);
            assert_1.strict.equal(result.ddSrcDirs.length, 1);
        });
        (0, mocha_1.it)('throws when homeDir does not exist on disk', () => {
            const badHome = SAMPLE_CONFIG.replace('Home=.', 'Home=.\\nonexistent-home');
            writeFixture({ content: badHome });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('throws when an appSrcDir does not exist on disk', () => {
            writeFixture({ skip: ['AppSrc'] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('throws when a ddSrcDir does not exist on disk', () => {
            writeFixture({ skip: ['DDSrc'] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('throws when programPath does not exist on disk', () => {
            writeFixture({ skip: ['Programs'] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('throws when a dataDir does not exist on disk', () => {
            // Also skip the filelist file so writeFile does not auto-create the Data dir
            writeFixture({ skip: ['Data', 'Data/filelist.cfg'] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('throws when filelistPath does not exist on disk', () => {
            writeFixture({ skip: ['Data/filelist.cfg'] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('does not throw when AppHTMLPath is absent (optional)', () => {
            writeFixture({ content: dropKey(SAMPLE_CONFIG, 'AppHTMLPath'), skip: ['AppHtml'] });
            assert_1.strict.doesNotThrow(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
        (0, mocha_1.it)('throws when AppHTMLPath is set but directory does not exist', () => {
            writeFixture({ skip: ['AppHtml'] });
            assert_1.strict.throws(() => DataflexWorkspaceResolver_1.DataflexWorkspaceResolver.parseConfigWs(configPath));
        });
    });
});
//# sourceMappingURL=DataflexWorkspaceResolver.test.js.map