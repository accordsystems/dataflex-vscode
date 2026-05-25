"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolIndexBuilder = void 0;
//import { Position, Location } from 'vscode-languageserver/node';
const dataflexScopes_1 = require("../common/dataflexScopes");
const SYMBOL_PATTERNS = [
    [/^\s*Procedure\s+(\w+)/i, 'procedure'],
    [/^\s*Function\s+(\w+)/i, 'function'],
    [/^\s*Class\s+(\w+)/i, 'class'],
    [/^\s*Object\s+(\w+)/i, 'object'],
    [/^\s*#DEFINE\s+(\w+)/i, 'define'],
];
class SymbolIndexBuilder {
    // Index the symbols in a document and update the symbol index
    static indexDocument(document) {
        const lines = document.getText().split(/\r?\n/);
        const documentUri = document.uri;
        const scopes = this.buildScopeHierarchy(lines, documentUri);
        const symbols = this.buildSymbolIndex(lines, documentUri, scopes);
        return { documentUri, symbols, scopes };
    }
    // Placeholder for symbol extraction logic. For now, it returns an empty array.
    static buildSymbolIndex(lines, documentUri, scopes) {
        const symbols = [];
        //iterate through lines, testing SYMBOL_PATTERNS
        lines.forEach((lineText, lineNumber) => {
            for (const [regex, type] of SYMBOL_PATTERNS) {
                const match = lineText.match(regex);
                if (match) {
                    if (!match?.[1])
                        break;
                    const name = match[1];
                    const scope = this.getInnermostScope(scopes, lineNumber);
                    const location = {
                        range: {
                            start: { line: lineNumber, character: 0 },
                            end: { line: lineNumber, character: lineText.length }
                        },
                        uri: documentUri
                    };
                    const symbol = {
                        location: location,
                        name: name,
                        scope: scope,
                        type: type,
                        visibility: 'public' //default to public for now
                    };
                    symbols.push(symbol);
                    break;
                }
            }
        });
        return symbols;
    }
    //#region Scope Building
    static buildScopeHierarchy(lines, documentUri) {
        const scopes = []; //All Scopes
        const scopeStack = []; //Current Scope Stack
        //global scope
        const globalScope = dataflexScopes_1.ScopeFactory.createGlobalScope(lines.length, documentUri);
        scopes.push(globalScope);
        scopeStack.push(globalScope); //to handle identifying parent scopes
        //Iterate through lines to find scope creating symbols
        lines.forEach((lineText, lineNumber) => {
            //Check for scope creating symbols
            //If found, create new scope and push to stack
            //If end of scope found, pop from stack
            //trim the line
            const trimmedLine = lineText.trim();
            //Check for scope creating symbols
            for (const [symbolType, symbolKeyword] of Object.entries(dataflexScopes_1.DATAFLEX_SCOPE_BEGIN_SYMBOLS)) {
                const regex = new RegExp(`^\\s*${symbolKeyword}\\s+(\\w+)`, 'i');
                const match = trimmedLine.match(regex);
                if (match) {
                    const symbolName = match[1]; // Extracted symbol name
                    if (!symbolName)
                        continue; //guard, should always be true due to regex but just in case
                    const newScope = {
                        name: symbolName,
                        type: symbolType,
                        startLine: lineNumber,
                        endLine: -1, // To be updated when scope ends
                        parentScope: scopeStack[scopeStack.length - 1] || null,
                        documentUri: documentUri
                    };
                    scopes.push(newScope);
                    scopeStack.push(newScope);
                    break; // Exit loop after finding a match                    
                }
            }
            //Check for scope ending symbols; if found, pop from stack and add end line#
            for (const [_endSymbolType, endSymbolKeyword] of Object.entries(dataflexScopes_1.DATAFLEX_SCOPE_END_SYMBOLS)) {
                if (trimmedLine.startsWith(endSymbolKeyword)) {
                    const currentScope = scopeStack.pop();
                    if (currentScope) {
                        currentScope.endLine = lineNumber;
                    }
                }
            }
        });
        return scopes;
    }
    //#endregion
    static getInnermostScope(scopes, lineNumber) {
        const filteredScopes = scopes.filter(s => s.startLine <= lineNumber &&
            (s.endLine === -1 || s.endLine >= lineNumber) //scope is either open (global) or ends after the line number
        );
        //return scope with greatest start line (innermost). There should always be a global scope.
        const innermost = filteredScopes.reduce((deepest, current) => current.startLine > deepest.startLine ? current : deepest);
        // If the innermost scope starts at this exact line and has a parent, the symbol
        // is being declared INTO this scope — attribute it to the containing (parent) scope instead.
        if (innermost.startLine === lineNumber && innermost.parentScope) {
            return innermost.parentScope;
        }
        return innermost;
    }
}
exports.SymbolIndexBuilder = SymbolIndexBuilder;
//Todo: Build Scope Hierarchy
//Todo: Index Symbols within Scopes
//Todo: Add Symbol to Index
//Todo: Find Definitions accessible from Position
//# sourceMappingURL=SymbolIndexBuilder.js.map