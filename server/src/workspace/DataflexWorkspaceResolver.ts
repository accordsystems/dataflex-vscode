import * as path from 'path';
import * as fs from 'fs';

export type SourceKind = 'appSrc' | 'ddSrc';

//Example Ini File
// [Properties]
// Version=19.1
// [WorkspacePaths]
// ConfigFile=.\Programs\Config.ws
// [Preferences]
// DefaultFormHeight=12
// [Conditionals]
// Is$WebApp=True
// [Libraries]
// Lib2=libs\libi20\asgI20-191.sws
// Lib1=libs\DataFlex DateTime Library 24.0\DateTime - 191.sws
// Lib3=libs\DataFlex Conversions Library 24.0\Conversions - 191.sws
// [Projects]
// Project0=WebApp.src
// Project1=CarmTests.src


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
    configPath: string;
    homeDir: string;
    appSrcDirs: string[];
    ddSrcDirs: string[];
    dataDirs: string[];
    filelistPath: string;
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
static validateParsedSws(
    swsPath: string, 
    parsedSws: Record<string, Record<string, string>>
): asserts parsedSws is ValidatedSwsIni{
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
    const projectKeys = Object.keys(projectsSection)
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
        for (const [libraryKey, libraryPath] of Object.entries(librariesSection)){
            if (libraryPath.trim() === ''){
                throw new Error(`Invalid library path for library "${libraryKey} in [Libraries] section: cannot be empty or whitespace`)
            }
            const resolvedLibraryPath = this.resolveRelativePath(swsDir, libraryPath)
            if (!fs.existsSync(resolvedLibraryPath)){
                throw new Error (`library path for "${libraryKey}" does not appear to exist at "${resolvedLibraryPath}`)
            }            
        }
    }
}

// Read a .sws file from disk, parse the INI, pull out the fields the resolver needs, resolve internal path references against the SWS file's own directory. Output:
// {
//     swsPath, swsDir, version,
//     projectFileNames,        // relative .src paths from [Projects], source order
//     conditionals,            // [Conditionals] section as-is
//     configFilePath,          // absolute, resolved against swsDir
//     librarySwsPaths,         // absolute, resolved against swsDir, source order
// }

static parseSws(swsPath: string): ParsedSws {
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
    const conditionalSection = parsedSws['conditionals'] ?? {} ;
    const librariesSection = parsedSws['libraries'];    

    const librarySwsPaths = librariesSection
        ? Object.values(librariesSection).map(p => this.resolveRelativePath(swsDir, p))
        : []   
    
    return {
        swsPath: swsPath,
        swsDir: swsDir,
        version: version, 
        projectFileNames: projectFileNames,
        conditionals: conditionalSection,
        configFilePath: configFilePath,
        librarySwsPaths: librarySwsPaths ?? []
    }
}
// static parseConfigWs(configPath: string): ParsedConfigWs {}
// static resolveWorkspace(swsPath: string): ResolvedWorkspace {}
}
