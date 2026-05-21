import * as path from 'path';
import * as fs from 'fs';

export type SourceKind = 'appSrc' | 'ddSrc';
export interface ResolvedSourceDir {
    absolutePath: string;
    kind: SourceKind;
    swsOrigin: string; //Absolute path of the direct sws that contributed this path
    depth: number; // 0 = main workspace, 1 = direct library, etc.
}
interface ValidatedSwsIni extends Record<string, Record<string, string>> {
    properties:     { version: string }    & Record<string, string>;    
    workspacepaths: { configfile: string } & Record<string, string>;
    projects: { } & Record<string,string>;
    // include other guaranteed keys here
}

interface ValidatedConfigWsIni extends Record<string, Record<string, string>> {
    workspace: {
        home: string;
        appsrcpath: string;
        apphtmlpath: string;
        //bitmappath: string;
        //idesrcpath: string;
        ddsrcpath: string;
        //helppath: string;
        programpath: string;
        //description: string;
        datapath: string;
        filelist: string;
    }
    & Record<string, string>;
}

export interface ParsedSws {
    swsPath: string;
    swsDir: string;
    version : string;
    projectFileNames : string[]; //relative paths of .src files
    conditionals : Record<string, string>;
    configFilePath: string;
    librarySwsPaths: string[]; 
}

export interface ParsedConfigWs {
    configPath: string; //Path of the config.ws file
    homeDir: string; //Often the parent directory of the configPath, but not necessarily. All relative paths in the config.ws are resolved against the HomeDir.
    appSrcDirs: string[];
    appHTMLDir: string;
    bitmapDirs: string[];
    ideSrcDirs: string[];
    ddSrcDirs: string[];
    helpDirs: string[];
    programPath: string;
    dataDirs: string[];
    filelistPath: string;
    description : string;
}

export interface ResolvedWorkspace {
    swsPath: string; //Main sws file path
    version: string;
    conditionals: Record<string, string>;
    sourceDirs: ResolvedSourceDir[]; //This workspace only
    config: ParsedConfigWs;
    libraries: ResolvedWorkspace[]; //Resolved library workspaces, sorted by depth
}

class ParseError extends Error {
    constructor(message: string, public lineNum: number) {
        super(message);
        this.name = 'ParseError';
    }
}

export class DataflexWorkspaceResolver{

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
static parseIni(iniFullText: string): Record<string, Record<string, string>> {

    const result: Record<string, Record<string, string>> = {};
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
            trimmedLine.includes('=')
        );
        if (!isComment && !isEmpty && !isSection && !isKeyValuePair){
            throw new ParseError(`invalid Line: ${trimmedLine}. not empty, comment, section, or valid kvp`, lineNum)
        }

        if (isEmpty || isComment) continue; //skip empty

        if (isSection){
            currentSection = trimmedLine.slice(1, -1).toLowerCase().trim();
            result[currentSection] ??= {};
            //console.log(`[parseIni] line ${lineNum}: section="${currentSection}"`);
        }

        if (isKeyValuePair){
            if (currentSection === '') throw new ParseError('key value pair detected before section header', lineNum);
            const kvpSeparatorIndex = trimmedLine.indexOf('=');
            const key = trimmedLine.slice(0,kvpSeparatorIndex).trim().toLowerCase();
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
static resolveRelativePath(baseDir: string, relativePath: string): string {
    if (relativePath.trim() === '') {
        throw new Error(`Invalid path: "${relativePath}". Path cannot be empty or whitespace.`);
    }
    //normalize in case this is somehow run from linux
    const normalizedRelativePath = relativePath.replaceAll('\\', path.sep).replaceAll('/', path.sep);
    return path.resolve(baseDir, normalizedRelativePath);
}

// Validate SWS File KVPs and Sections from parseSWS function. Throw if invalid. 
// parseSWS returns everything in lowercase
// Validates structure only — no disk access. Path existence is checked separately in checkResolvedSwsPaths.
// Validation includes:
// - Required Sections: [Properties], [WorkspacePaths], [Projects]
// - Required KVPs: Version in [Properties], at least 1 Project in [Projects], ConfigFile in [WorkspacePaths]
// - Blank values rejected for all required keys and any library entries
// - Libraries and Conditionals are optional sections
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
static validateParsedSws(
    parsedSws: Record<string, Record<string, string>>
): asserts parsedSws is ValidatedSwsIni {
    //Properties
    const propertiesSection = parsedSws['properties'];
    if (!propertiesSection)
        throw new Error('Missing required [Properties] section');
    if (!propertiesSection['version'])
        throw new Error('Missing required key "Version" in [Properties] section');

    //WorkspacePaths
    const workspacePathsSection = parsedSws['workspacepaths'];
    if (!workspacePathsSection)
        throw new Error('Missing required [WorkspacePaths] section');
    if (!workspacePathsSection['configfile'] || workspacePathsSection['configfile'].trim() === '')
        throw new Error('Missing or blank required key "ConfigFile" in [WorkspacePaths] section');

    //Projects
    const projectsSection = parsedSws['projects'];
    if (!projectsSection)
        throw new Error('Missing required [Projects] section');
    if (Object.keys(projectsSection).length === 0)
        throw new Error('At least one project is required in [Projects] section');
    for (const [projectKey, projectRelativePath] of Object.entries(projectsSection)) {
        if (projectRelativePath.trim() === '')
            throw new Error(`Invalid path for project "${projectKey}" in [Projects] section: cannot be empty or whitespace`);
    }

    //Libraries (optional) — blank values are invalid if the key exists
    const librariesSection = parsedSws['libraries'];
    if (librariesSection) {
        for (const [libraryKey, libraryPath] of Object.entries(librariesSection)) {
            if (libraryPath.trim() === '')
                throw new Error(`Invalid library path for library "${libraryKey}" in [Libraries] section: cannot be empty or whitespace`);
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
static parseSws(swsPath: string): ParsedSws {
    // Check for File existence and throw if not found
    const resolvedPath = path.resolve(swsPath); //will throw if invalid path, but not if file doesn't exist. We'll check that separately       
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`SWS file not found at path: "${resolvedPath}"`);
    }
    //get dirname
    const swsDir = path.dirname(resolvedPath);
    // Read in File Content
    const swsContent = fs.readFileSync(resolvedPath, 'utf-8');   
    // Parse as Ini
    const parsedSws = this.parseIni(swsContent);
    // Validate structure
    this.validateParsedSws(parsedSws);
    // Build result
    const version = parsedSws['properties']['version'];
    const configFilePath = this.resolveRelativePath(swsDir, parsedSws['workspacepaths'].configfile);
    const projectFileNames = Object.values(parsedSws['projects']);
    const conditionalSection = parsedSws['conditionals'] ?? {};
    const librariesSection = parsedSws['libraries'];
    const librarySwsPaths = librariesSection
        ? Object.values(librariesSection).map(p => this.resolveRelativePath(swsDir, p))
        : [];
    const result: ParsedSws = {
        swsPath: resolvedPath,
        swsDir: swsDir,
        version: version,
        projectFileNames: projectFileNames,
        conditionals: conditionalSection,
        configFilePath: configFilePath,
        librarySwsPaths: librarySwsPaths
    };
    // Check resolved paths exist on disk
    this.checkResolvedSwsPaths(result);
    return result;
}

private static checkResolvedSwsPaths(sws: ParsedSws): void {
    if (!fs.existsSync(sws.configFilePath))
        throw new Error(`Config file not found: "${sws.configFilePath}"`);

    for (const projectFile of sws.projectFileNames) {
        const resolved = this.resolveRelativePath(sws.swsDir, projectFile);
        if (!fs.existsSync(resolved))
            throw new Error(`Project file not found: "${resolved}"`);
    }

    for (const libPath of sws.librarySwsPaths) {
        if (!fs.existsSync(libPath))
            throw new Error(`Library SWS not found: "${libPath}"`);
    }
}

static validateParsedWs(
    parsedWsIni: Record<string, Record<string, string>>
): asserts parsedWsIni is ValidatedConfigWsIni{
    //Properties
    const workspaceSection = parsedWsIni['workspace'];
    if (!workspaceSection) {
        throw new Error('Missing required [Workspace] section');
    }    
    //Home
    // check home key exists
    // resolve path
    // check home path exists
    if (!workspaceSection['home']) {
        throw new Error('Missing required key "Home" in [Workspace] section');
    }    
    //AppSrc key : Exists, can access paths
    if (!workspaceSection['appsrcpath']){
        throw new Error('Missing required key "AppSrcPath" in [Workspace] section');
    }
    //AppHTML : Optional
    //DdSrcPath : Exists, can access paths   
    if (!workspaceSection['ddsrcpath']){
        throw new Error('Missing required key "DdSrcPath" in [Workspace] section');
    }
    //ProgramPath : Exists, can access path 
    if (!workspaceSection['programpath']){
        throw new Error('Missing required key "ProgramPath" in [Workspace] section');
    }
    //DataPath : Directories exist
    if (!workspaceSection['datapath']){
        throw new Error('Missing required key "DataPath" in [Workspace] section');
    }
    //FileList: required, exists and can access file
    if (!workspaceSection['filelist']){
        throw new Error('Missing required key "FileList" in [Workspace] section');
    }
    // Not Required:
    //Description
    //BitmapPath
    //IdeSrcPath
    //HelpPath    
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
static parseConfigWsContent(configPath: string,configContent: string): ParsedConfigWs {    
    
    
    const parsedConfigWs = this.parseIni(configContent);    
    this.validateParsedWs(parsedConfigWs);
    // Fill in Sections    
    const configDir = path.dirname(configPath);
    // [Workspace]
    // Home : Single Path, Usually "..\" as config is by convention in the Program Path if Relative, resolve relative to config path. if absolute, use that    
    const homeDir = parsedConfigWs['workspace']['home'];
    const resolvedhomeDir = this.resolveRelativePath(configDir, homeDir);
    // AppSrcPath : Multiple, split with, resolve against homepath ;
    const appsrcKey = parsedConfigWs['workspace']['appsrcpath']    
    const resolvedAppSrcDirs = appsrcKey
        .split(';')
        .filter(dir => dir.trim() !== '')
        .map(dir => this.resolveRelativePath(resolvedhomeDir, dir));        
    // AppHtmlPath : Single Path, optional
    const rawAppHtmlPath = parsedConfigWs['workspace']['apphtmlpath'];
    const resolvedAppHtmlPath = rawAppHtmlPath
        ? this.resolveRelativePath(resolvedhomeDir, rawAppHtmlPath)
        : '';
    // BitmapPaths : Multiple, Optional
    const resolvedBitMapDirs = parsedConfigWs['workspace']['bitmappath']
        ?.split(';')
        .filter(dir => dir.trim() !== '')
        .map(dir => this.resolveRelativePath(resolvedhomeDir, dir)) ?? [];        
    // IdeSrcPath: Multiple, Optional
    const resolvedIdePath = parsedConfigWs['workspace']['idesrcpath']
        ?.split(';')
        .filter(dir => dir.trim() !== '')
        .map(dir => this.resolveRelativePath(resolvedhomeDir, dir)) ?? []; //could be null    
    // DdSrcPath : Required, multiple
    const resolvedDdSrcDirs = parsedConfigWs['workspace']['ddsrcpath']
        .split(';')
        .filter(dir => dir.trim() !== '')
        .map(dir => this.resolveRelativePath(resolvedhomeDir, dir)); //could be null    
    
        // HelpPath
    const resolvedHelpDirs = parsedConfigWs['workspace']['helppath']
    ?.split(';')
    .filter(dir => dir.trim() !== '')
    .map(dir => this.resolveRelativePath(resolvedhomeDir, dir)) ?? []; //could be null    
    // ProgramPath: Required, singular
    const resolvedProgramPath = this.resolveRelativePath(resolvedhomeDir,parsedConfigWs['workspace']['programpath']);
    // Description
    const description = parsedConfigWs['workspace']['description'] ?? '';
    // DataPath
    const resolvedDataDirs = parsedConfigWs['workspace']['datapath']
    .split(';')
    .filter(dir => dir.trim() !== '')
    .map(dir => this.resolveRelativePath(resolvedhomeDir, dir)); //could be null    
    // FileListPath
    const resolvedFileListPath = this.resolveRelativePath(resolvedhomeDir, parsedConfigWs['workspace']['filelist'])
    const result: ParsedConfigWs = {
        configPath: configPath,
        homeDir: resolvedhomeDir,
        appSrcDirs: resolvedAppSrcDirs,
        appHTMLDir: resolvedAppHtmlPath,
        bitmapDirs: resolvedBitMapDirs,
        ideSrcDirs: resolvedIdePath,
        ddSrcDirs: resolvedDdSrcDirs,
        helpDirs: resolvedHelpDirs,
        programPath: resolvedProgramPath,
        description : description,
        dataDirs: resolvedDataDirs,
        filelistPath: resolvedFileListPath
    }    
    return result;
}

private static checkResolvedConfigWsPaths(config: ParsedConfigWs): void {
    if (!fs.existsSync(config.homeDir))
        throw new Error(`Home directory not found: "${config.homeDir}"`);

    for (const dir of config.appSrcDirs) {
        if (!fs.existsSync(dir))
            throw new Error(`AppSrc directory not found: "${dir}"`);
    }

    for (const dir of config.ddSrcDirs) {
        if (!fs.existsSync(dir))
            throw new Error(`DdSrc directory not found: "${dir}"`);
    }

    if (!fs.existsSync(config.programPath))
        throw new Error(`Program directory not found: "${config.programPath}"`);

    for (const dir of config.dataDirs) {
        if (!fs.existsSync(dir))
            throw new Error(`Data directory not found: "${dir}"`);
    }

    if (!fs.existsSync(config.filelistPath))
        throw new Error(`FileList not found: "${config.filelistPath}"`);

    // Optional — only checked if present
    if (config.appHTMLDir && !fs.existsSync(config.appHTMLDir))
        throw new Error(`AppHTML directory not found: "${config.appHTMLDir}"`);

    for (const dir of config.bitmapDirs) {
        if (!fs.existsSync(dir))
            throw new Error(`Bitmap directory not found: "${dir}"`);
    }

    for (const dir of config.ideSrcDirs) {
        if (!fs.existsSync(dir))
            throw new Error(`IdeSrc directory not found: "${dir}"`);
    }

    for (const dir of config.helpDirs) {
        if (!fs.existsSync(dir))
            throw new Error(`Help directory not found: "${dir}"`);
    }
}

static parseConfigWs(configPath: string): ParsedConfigWs {
    const resolvedConfigPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedConfigPath)){
        throw new Error(`Config.ws file not found at path: "${resolvedConfigPath}"`)
    }
    const configContent = fs.readFileSync(resolvedConfigPath, 'utf-8');
    const result = this.parseConfigWsContent(resolvedConfigPath, configContent);    
    //check paths
    this.checkResolvedConfigWsPaths(result);

    return result
}
// static resolveWorkspace(swsPath: string): ResolvedWorkspace {}
}
