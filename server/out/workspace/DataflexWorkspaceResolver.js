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
class ParseError extends Error {
    lineNum;
    constructor(message, lineNum) {
        super(message);
        this.lineNum = lineNum;
        this.name = 'ParseError';
    }
}
class DataflexWorkspaceResolver {
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
    static parseIni(iniFullText) {
        const result = {};
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
                trimmedLine.includes('='));
            if (!isComment && !isEmpty && !isSection && !isKeyValuePair) {
                throw new ParseError(`invalid Line: ${trimmedLine}. not empty, comment, section, or valid kvp`, lineNum);
            }
            if (isEmpty || isComment)
                continue; //skip empty
            if (isSection) {
                currentSection = trimmedLine.slice(1, -1).toLowerCase().trim();
                result[currentSection] ??= {};
                console.log(`[parseIni] line ${lineNum}: section="${currentSection}"`);
            }
            if (isKeyValuePair) {
                if (currentSection === '')
                    throw new ParseError('key value pair detected before section header', lineNum);
                const kvpSeparatorIndex = trimmedLine.indexOf('=');
                const key = trimmedLine.slice(0, kvpSeparatorIndex).trim().toLowerCase();
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
    static resolvePath(baseDir, relativePath) {
        if (relativePath.trim() === '') {
            throw new Error(`Invalid path: "${relativePath}". Path cannot be empty or whitespace.`);
        }
        //normalize in case this is somehow run from linux
        const normalizedRelativePath = relativePath.replaceAll('\\', path.sep).replaceAll('/', path.sep);
        return path.resolve(baseDir, normalizedRelativePath);
    }
}
exports.DataflexWorkspaceResolver = DataflexWorkspaceResolver;
//# sourceMappingURL=DataflexWorkspaceResolver.js.map