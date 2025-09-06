import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Location } from 'vscode-languageserver/node';
import { DATAFLEX_SCOPE_BEGIN_SYMBOLS, 
    DATAFLEX_SCOPE_END_SYMBOLS, 
    DATAFLEX_SCOPE_TYPES, 
    ScopeInfo,
    ScopeFactory } from '../common/dataflexScopes';
import { SymbolDefinition } from '../Symbols/dataflexSymbols';


export interface DocumentSymbolIndex {
    documentUri: string;
    symbols: SymbolDefinition[];
    scopes: ScopeInfo[];
}

export class SymbolIndexBuilder {        
    // Index the symbols in a document and update the symbol index
    static indexDocument(document: TextDocument): DocumentSymbolIndex {
        const lines = document.getText().split(/\r?\n/);
        const documentUri = document.uri;
        const scopes = this.buildScopeHierarchy(lines, documentUri);
        const symbols = this.buildSymbolIndex(lines, documentUri, scopes);
        return { documentUri, symbols, scopes };
    }    

    private static buildSymbolIndex(lines: string[], documentUri: string, scopes: ScopeInfo[]): SymbolDefinition[] {
        const symbols: SymbolDefinition[] = [];
        // Placeholder for symbol extraction logic
        return symbols;
    }

    //#region Scope Building
    private static buildScopeHierarchy(lines: string[], documentUri: string): ScopeInfo[] {
        const scopes: ScopeInfo[] = []; //All Scopes
        const scopeStack: ScopeInfo[] = []; //Current Scope Stack

        //global scope
        const globalScope = ScopeFactory.createGlobalScope(lines.length, documentUri);
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
            for (const [symbolType, symbolKeyword] of Object.entries(DATAFLEX_SCOPE_BEGIN_SYMBOLS)) {
                const regex = new RegExp(`^\\s*${symbolKeyword}\\s+(\\w+)`, 'i');
                const match = trimmedLine.match(regex);
                if (match) {
                    const symbolName = match[1]; // Extracted symbol name
                    const newScope: ScopeInfo = {
                        name: symbolName,
                        type: symbolType as keyof typeof DATAFLEX_SCOPE_TYPES,
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
            for (const [endSymbolType, endSymbolKeyword] of Object.entries(DATAFLEX_SCOPE_END_SYMBOLS)) {
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
    
    
}
    
//Todo: Build Scope Hierarchy

//Todo: Index Symbols within Scopes

//Todo: Get the Scope at the Current Line

//Todo: Add Symbol to Index

//Todo: Find Definitions accessible from Position

