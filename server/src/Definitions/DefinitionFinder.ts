import { Location, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ScopeInfo, ScopeFactory } from "../common/dataflexScopes";
import { SymbolDefinition } from "../Symbols/dataflexSymbols";
import { SymbolIndexBuilder } from "../Symbols/SymbolIndexBuilder";

export class DefinitionFinder {
    private symbolIndex: Map<string, SymbolDefinition[]> = new Map();
    private documentScopes: Map<string, ScopeInfo[]> = new Map();
    /**
     * Update the index with new document data
     */
    updateDocument(document: TextDocument): void {
        const uri = document.uri;
        // Clear existing data
        this.clearDocumentSymbols(uri);        
        //Index the Document
        const documentIndex = SymbolIndexBuilder.indexDocument(document);        
        // Add new data
        // Add Scopes
        // Add Symbols
        this.documentScopes.set(uri, documentIndex.scopes);
        
        for (const symbol of documentIndex.symbols) {
            //Derive a key for the symbol
            const key = (symbol.name + '|' + symbol.type + '|' + symbol.documentUri + '|' + symbol.location.range.start.line).toLowerCase();
            if (!this.symbolIndex.has(key)) {
                this.symbolIndex.set(key, []);
            }
            this.symbolIndex.get(key)!.push(symbol);
        }
    }

    /**
     * Find definitions accessible from a given position
     */
    findDefinitions(symbol: string, position: Position, requestUri: string): Location[] {
        const candidates = this.symbolIndex.get(symbol.toLowerCase()) || [];
        const requestScopes = this.documentScopes.get(requestUri) || [];
        const requestScope = this.getScopeAtPosition(requestScopes, position, requestUri);
        
        const accessibleDefinitions = candidates.filter(candidate => 
            this.isSymbolAccessible(candidate, requestScope, requestUri)
        );
        
        return accessibleDefinitions.map(def => def.location);
    }

    //Todo: Expand to Workspace
    private isSymbolAccessible(symbol: SymbolDefinition, requestScope: ScopeInfo, requestUri: string): boolean {
        // Same document and same or child scope
        if (symbol.documentUri === requestUri && 
            this.isSameOrChildScope(requestScope, symbol.scope)) {
            return true;
        }
        // Global symbols accessible from anywhere
        return symbol.visibility === 'global';
    }

    private isSameOrChildScope(child: ScopeInfo, parent: ScopeInfo): boolean {
        let current: ScopeInfo | null = child;
        while (current) {
            if (current === parent) {
                return true;
            }
            current = current.parentScope;
        }
        return false;
    }

    private getScopeAtPosition(scopes: ScopeInfo[], position: Position, documentUri: string): ScopeInfo {
        //filter scopes for the current document
        const documentScopes = scopes.filter(s => s.documentUri === documentUri);
        let currentScope : ScopeInfo = documentScopes.find(s => s.type === 'global') || ScopeFactory.createGlobalScope(0, documentUri);

        for (const scope of documentScopes) {
            if (scope.startLine <= position.line && 
                (scope.endLine === -1 || position.line <= scope.endLine)) {
                if (scope.type !== 'global') {
                    currentScope = scope;
                }
            }
        }
        
        return currentScope;
    }

    private clearDocumentSymbols(uri: string): void {
        this.symbolIndex.forEach((symbols, key) => {
            this.symbolIndex.set(key, symbols.filter(s => s.documentUri !== uri));
        });
        this.documentScopes.delete(uri);
    }
}