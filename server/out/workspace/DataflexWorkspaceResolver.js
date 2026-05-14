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
exports.DataflexWorkspaceResolver = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ParseError extends Error {
    lineNum;
    constructor(message, lineNum) {
        super(message);
        this.lineNum = lineNum;
        this.name = 'ParseError';
    }
}
class DataflexWorkspaceResolver {
    /**
     *
     * @param iniFullText
     * @returns Record<string, Record<string, string>>
     *
     * Rules:
     * - Sections and keys are lowercased.
     * - Comments start with `;` or `#`.
     * - First `=` is the key/value separator; values may contain `=`.
     * - Duplicate keys in the same section: last value wins.
     *
     */
    static parseIni(iniFullText) {
        const result = {};
        let currentSection = '';
        let lineNum = 0;
        // Split text into lines, supporting both \n and \r\n
        const lines = iniFullText.split(/\r?\n/);
        //console.log(`[parseIni] parsing ${lines.length} lines`);
        for (const line of lines) {
            lineNum++;
            const trimmedLine = line.trim();
            const isComment = trimmedLine.startsWith(';') || trimmedLine.startsWith('#');
            const isEmpty = trimmedLine === '';
            const isSection = trimmedLine.startsWith('[') && trimmedLine.endsWith(']');
            const isKeyValuePair = (!isComment && !isEmpty && !isSection &&
                trimmedLine.includes('='));
            if (!isComment && !isEmpty && !isSection && !isKeyValuePair) {
                throw new ParseError(`invalid Line: ${trimmedLine}. not empty, comment, section, or valid kvp`, lineNum);
            }
            if (isEmpty || isComment)
                continue; //skip empty
            if (isSection) {
                currentSection = trimmedLine.slice(1, -1).toLowerCase().trim();
                result[currentSection] ??= {};
                //console.log(`[parseIni] line ${lineNum}: section="${currentSection}"`);
            }
            if (isKeyValuePair) {
                if (currentSection === '')
                    throw new ParseError('key value pair detected before section header', lineNum);
                const kvpSeparatorIndex = trimmedLine.indexOf('=');
                const key = trimmedLine.slice(0, kvpSeparatorIndex).trim().toLowerCase();
                const value = trimmedLine.slice(kvpSeparatorIndex + 1).trim();
                const section = (result[currentSection] ??= {});
                section[key] = value;
                //console.log(`[parseIni] line ${lineNum}: [${currentSection}] ${key}="${value}"`);
            }
        }
        //console.log(`[parseIni] done, ${Object.keys(result).length} sections`);
        return result;
    }
    //non-private for testing
    static resolveRelativePath(baseDir, relativePath) {
        if (relativePath.trim() === '') {
            throw new Error(`Invalid path: "${relativePath}". Path cannot be empty or whitespace.`);
        }
        //normalize in case this is somehow run from linux
        const normalizedRelativePath = relativePath.replaceAll('\\', path.sep).replaceAll('/', path.sep);
        return path.resolve(baseDir, normalizedRelativePath);
    }
    // Validate SWS File KVPs and Sections from parseSWS function. Throw if invalid. 
    // parseSWS returns everything in lowercase
    // Validation includes:
    // - Required Sections: [Properties], [WorkspacePaths], [Projects]
    // - Required KVPs: Version in [Properties], at least 1 Project in [Projects], ConfigFile in [WorkspacePaths]
    // - No duplicate project keys (Project0, Project1, etc. must be sequential with no gaps)
    // - Valid paths for ConfigFile and Projects (relative dirs are relative to swsDir, may be absolute, must exist on disk)
    // - Libraries (Optional) - If exist, do they resolve?
    //
    // Sample INI File
    // 
    // [Properties] <- Required
    // Version=19.1
    // [WorkspacePaths] <- Required
    // ConfigFile=.\Programs\Config.ws <- Required
    // [Preferences]
    // DefaultFormHeight=12
    // [Conditionals] 
    // Is$WebApp=True
    // [Libraries]
    // Lib2=libs\libi20\asgI20-191.sws
    // Lib1=libs\DataFlex DateTime Library 24.0\DateTime - 191.sws
    // Lib3=libs\DataFlex Conversions Library 24.0\Conversions - 191.sws
    // [Projects] <- Required, with at least one project
    // Project0=WebApp.src
    // Project1=CarmTests.src
    static validateParsedSws(swsPath, parsedSws) {
        //Properties
        const propertiesSection = parsedSws['properties'];
        if (!propertiesSection) {
            throw new Error('Missing required [Properties] section');
        }
        //Properties : Check Version
        if (!propertiesSection['version']) {
            throw new Error('Missing required key "Version" in [Properties] section');
        }
        //WorkspacePaths: Required: Check Section Exists, then Check ConfigFile exists, is a valid path, can be accessed.
        const workspacePathsSection = parsedSws['workspacepaths'];
        if (!workspacePathsSection) {
            throw new Error('Missing required [WorkspacePaths] section');
        }
        // WorkspacePaths: Check ConfigFile exists and is valid path
        if (!workspacePathsSection['configfile']) {
            throw new Error('Missing required key "ConfigFile" in [WorkspacePaths] section');
        }
        if (workspacePathsSection['configfile'].trim() === '') {
            throw new Error('Invalid "ConfigFile" path in [WorkspacePaths] section: cannot be empty or whitespace');
        }
        // Resolve ConfigFile path against swsDir and check existence
        const swsDir = path.dirname(swsPath);
        const resolvedConfigFilePath = this.resolveRelativePath(swsDir, workspacePathsSection['configfile']);
        if (!fs.existsSync(resolvedConfigFilePath)) {
            throw new Error(`Config file not found at path: "${resolvedConfigFilePath}"`);
        }
        //Projects: Check Section Exists. for each key, check uniqueness, valid path, existence. At least 1 project is required. 
        const projectsSection = parsedSws['projects'];
        if (!projectsSection) {
            throw new Error('Missing required [Projects] section');
        }
        // Projects: Check for at least 1 project. name doesn't matter, but must be unique
        const projectKeys = Object.keys(projectsSection);
        if (projectKeys.length === 0) {
            throw new Error('At least one project is required in [Projects] section');
        }
        //Projects: At least 1 project, no dupes. Check that each project file exists and is valid path
        for (const [projectKey, projectRelativePath] of Object.entries(projectsSection)) {
            if (projectRelativePath.trim() === '') {
                throw new Error(`Invalid path for project "${projectKey}" in [Projects] section: cannot be empty or whitespace`);
            }
            const resolvedProjectPath = this.resolveRelativePath(swsDir, projectRelativePath);
            if (!fs.existsSync(resolvedProjectPath)) {
                throw new Error(`Project file for "${projectKey}" not found at path: "${resolvedProjectPath}"`);
            }
        }
        //Check Libraries: Keys must be unique, values must be valid paths if they exist. Libraries are optional, so 0 is valid.
        const librariesSection = parsedSws['libraries'];
        if (librariesSection) {
            for (const [libraryKey, libraryPath] of Object.entries(librariesSection)) {
                if (libraryPath.trim() === '') {
                    throw new Error(`Invalid library path for library "${libraryKey} in [Libraries] section: cannot be empty or whitespace`);
                }
                const resolvedLibraryPath = this.resolveRelativePath(swsDir, libraryPath);
                if (!fs.existsSync(resolvedLibraryPath)) {
                    throw new Error(`library path for "${libraryKey}" does not appear to exist at "${resolvedLibraryPath}`);
                }
            }
        }
    }
    /**
     * Parses a .sws file from disk and extracts the relevant fields for the resolver.
     * @param swsPath The file path to the .sws file to be parsed.
     * @returns {ParsedSws} An object containing the parsed fields from the .sws file, including:
    * - `swsPath`: The original file path of the .sws file.
    * - `swsDir`: The directory containing the .sws file.
    * - `version`: The version of the workspace as specified in the .sws file.
    * - `projectFileNames`: An array of project file names (relative paths) specified in the .sws file.
    * - `conditionals`: An object containing the conditional compilation symbols defined in the .sws file.
    * - `configFilePath`: The resolved absolute path to the Config.ws file specified in the .sws file.
    * - `librarySwsPaths`: An array of resolved absolute paths to library .sws files specified in the .sws file.
    * @throws Error if the .sws file is missing, cannot be read, or contains invalid content (e.g., missing required sections or keys, invalid paths).
    * @example
    * Given a .sws file with the following content:
    * ```ini
    * [Properties]
    * Version=19.1
    * [WorkspacePaths]
    * ConfigFile=.\Programs\Config.ws
    * [Conditionals]
    * Is$WebApp=True
    * [Libraries]
    * Lib2=libs\libi20\asgI20-191.sws
    * Lib1=libs\DataFlex DateTime Library 24.0\DateTime - 191.sws
    * Lib3=libs\DataFlex Conversions Library 24.0\Conversions - 191.sws
    * [Projects]
    * Project0=WebApp.src
    * Project1=CarmTests.src
    * ```
    * The `parseSws` function will return an object with the following structure:
    * ```typescript
    * {
    *   swsPath: 'path/to/workspace.sws',
    *   swsDir: 'path/to',
    *  version: '19.1',
    *  projectFileNames: ['WebApp.src', 'CarmTests.src'],
    * conditionals: { Is$WebApp: 'True' },
    * configFilePath: 'path/to/Programs/Config.ws',
    * librarySwsPaths: [
    *   'path/to/libs/libi20/asgI20-191.sws',
    *  'path/to/libs/DataFlex DateTime Library 24.0/DateTime - 191.sws',
    * 'path/to/libs/DataFlex Conversions Library 24.0/Conversions - 191.sws'
    * ]
    * }
    * ```
    */
    static parseSws(swsPath) {
        // Check for File existence and throw if not found
        const resolvedPath = path.resolve(swsPath); //will throw if invalid path, but not if file doesn't exist. We'll check that separately       
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`SWS file not found at path: "${resolvedPath}"`);
        }
        //get dirname
        const swsDir = path.dirname(resolvedPath);
        // Read in File Contect
        const swsContent = fs.readFileSync(resolvedPath, 'utf-8');
        // Parse as Ini
        const parsedSws = this.parseIni(swsContent);
        // Validate
        this.validateParsedSws(resolvedPath, parsedSws);
        // Fill in Sections into ParsedSws Object and return    
        const version = parsedSws['properties']['version'];
        const configFilePath = this.resolveRelativePath(swsDir, parsedSws['workspacepaths'].configfile);
        const projectSection = parsedSws['projects'];
        const projectFileNames = Object.values(projectSection);
        // Optional: Conditionals, library Paths
        const conditionalSection = parsedSws['conditionals'] ?? {};
        const librariesSection = parsedSws['libraries'];
        const librarySwsPaths = librariesSection
            ? Object.values(librariesSection).map(p => this.resolveRelativePath(swsDir, p))
            : [];
        return {
            swsPath: swsPath,
            swsDir: swsDir,
            version: version,
            projectFileNames: projectFileNames,
            conditionals: conditionalSection,
            configFilePath: configFilePath,
            librarySwsPaths: librarySwsPaths ?? []
        };
    }
    /**
     * Parses the UTF-8 content of a Config.ws file and extracts the relevant fields for the resolver.
     *
     * @param configContent
     * @returns {ParsedConfigWs} An object containing the parsed fields from the Config.ws file, including:
     * - `homeDir`: The Home directory specified in the Config.ws file.
     * - `appSrcDirs`: An array of application source directories specified in the Config.ws file.
     * - `ddSrcDirs`: An array of DD source directories specified in the Config.ws file.
     * - `dataDirs`: An array of data directories specified in the Config.ws file.
     * - `filelistPath`: The path to the file list specified in the Config.ws file.
     * @throws Error if required fields are missing or invalid in the config content.
     * @example
     * ```ini
     * [Workspace]
        Home=..\
        AppSrcPath=.\AppSrc
        AppHTMLPath=.\AppHtml
        BitmapPath=.\Bitmaps
        IdeSrcPath=.\IdeSrc
        DDSrcPath=.\DDSrc;.\Libs\Lib002\DDSrc;.\Libs\Lib001\DdSrc;
        HelpPath=.\Help
        ProgramPath=.\Programs
        Description=Example Config.ws file
        DataPath=D:\some\data\path
        FileList=D:\some\data\path\filelist.cfg
     * ```
    */
    static parseConfigWsContent(configContent) {
        // dummy read for compiler
        var configContentDummy = configContent;
        configContentDummy += '';
        // For now, just return dummy data. We'll fill this in later when we implement config.ws parsing.
        return {
            configPath: 'dummyConfigPath',
            homeDir: 'dummyHomeDir',
            appSrcDirs: ['dummyAppSrcDir1', 'dummyAppSrcDir2'],
            ddSrcDirs: ['dummyDdSrcDir1', 'dummyDdSrcDir2'],
            dataDirs: ['dummyDataDir1', 'dummyDataDir2'],
            filelistPath: 'dummyFilelistPath'
        };
    }
    /**
     *
     * @param iniFullText
     * @returns Record<string, Record<string, string>>
     *
     * Rules:
     *
     */
    static parseConfigWs(configPath) {
        //return dummy for now
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return this.parseConfigWsContent(configContent);
    }
}
exports.DataflexWorkspaceResolver = DataflexWorkspaceResolver;
//# sourceMappingURL=DataflexWorkspaceResolver.js.map