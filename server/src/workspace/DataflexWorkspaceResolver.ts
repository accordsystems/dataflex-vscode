import * as path from 'path';

export type SourceKind = 'appSrc' | 'ddSrc';

export interface ResolvedSourceDir {
    absolutePath: string;
    kind: SourceKind;
    swsOrigin: string; //Absolute path of the direct sws that contributed this path
    depth: number; // 0 = main workspace, 1 = direct library, etc.
}

export interface ParsedSws {
    swsPath: string;
    swsDir: string;
    version : string;
    projectFileNames : string[]; //relative paths of .src files
    conditionals : Record<string, string>;
    configFilePath: string;
    librarySwsPaths: string[]; //sorted Lib1, Lib2, etc.    
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
// Section Name -> Key -> Value
// Line Starts: ; and # are comments, ignore. ; is valid within a line to separate multiple values. No sense in parsing these here
// Skip Empty Lines
// [SectionName] Starts a new section, section name is the text within the brackets. Trim whitespace. Case insensitive
// Key=Value pairs. 
//  Trim whitespace around key and value. 
//  Case insensitive keys. 
//  Value is the text after the =, can be empty. 
//  If multiple key=value pairs exist on the same line, separated by ;, parse them all. 
//  If the same key is defined multiple times within the same section, last one wins.
//  the first = is the separator, so key=value=with=equals would have key "key" and value "value=with=equals"

static parseIni(iniFullText: string): Record<string, Record<string, string>> {

    const result: Record<string, Record<string, string>> = {};
    let currentSection = '';
    let lineNum = 0;

    // Split text into lines, supporting both \n and \r\n
    const lines = iniFullText.split(/\r?\n/);
    console.log(`[parseIni] parsing ${lines.length} lines`);

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
            console.log(`[parseIni] line ${lineNum}: section="${currentSection}"`);
        }

        if (isKeyValuePair){
            if (currentSection === '') throw new ParseError('key value pair detected before section header', lineNum);
            const kvpSeparatorIndex = trimmedLine.indexOf('=');
            const key = trimmedLine.slice(0,kvpSeparatorIndex).trim().toLowerCase();
            const value = trimmedLine.slice(kvpSeparatorIndex + 1).trim();
            const section = (result[currentSection] ??= {});
            section[key] = value;
            console.log(`[parseIni] line ${lineNum}: [${currentSection}] ${key}="${value}"`);
        }
    }
    console.log(`[parseIni] done, ${Object.keys(result).length} sections`);
    return result;
}

//non-private for testing
static resolvePath(baseDir: string, relativePath: string): string {
    if (relativePath.trim() === '') {
        throw new Error(`Invalid path: "${relativePath}". Path cannot be empty or whitespace.`);
    }
    //normalize in case this is somehow run from linux
    const normalizedRelativePath = relativePath.replaceAll('\\', path.sep).replaceAll('/', path.sep);
    return path.resolve(baseDir, normalizedRelativePath);
}

// // Parses the .sws file and returns the relevant information for workspace resolution
// static parseSws(swsPath: string): ParsedSws {
//     // Check for File existence and throw if not found
//     // Read in File Contect
//     // Parse File Content
//     // Check for Required Sections. [Properties], [WorkspacePaths], [Projects]
//     // Fill in Sections into ParsedSws Object and return
// }

// static parseConfigWs(configPath: string): ParsedConfigWs {}

// static resolveWorkspace(swsPath: string): ResolvedWorkspace {}

}
