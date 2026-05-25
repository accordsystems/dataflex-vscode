"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionFinder = void 0;
const dataflexScopes_1 = require("../common/dataflexScopes");
const SymbolIndexBuilder_1 = require("../Symbols/SymbolIndexBuilder");
class DefinitionFinder {
    symbolIndex = new Map();
    documentScopes = new Map();
    /**
     * Update the index with new document data
     */
    updateDocument(document) {
        const uri = document.uri;
        // Clear existing data
        this.clearDocumentSymbols(uri);
        //Index the Document
        const documentIndex = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(document);
        // Add new data
        // Add Scopes
        // Add Symbols
        this.documentScopes.set(uri, documentIndex.scopes);
        for (const symbol of documentIndex.symbols) {
            //Derive a key for the symbol
            const key = (symbol.name + '|' + symbol.type + '|' + symbol.location.uri + '|' + symbol.location.range.start.line).toLowerCase();
            if (!this.symbolIndex.has(key)) {
                this.symbolIndex.set(key, []);
            }
            this.symbolIndex.get(key).push(symbol);
        }
    }
    /**
     * Find definitions accessible from a given position
     */
    findDefinitions(symbol, position, requestUri) {
        const candidates = this.symbolIndex.get(symbol.toLowerCase()) || [];
        const requestScopes = this.documentScopes.get(requestUri) || [];
        const requestScope = this.getScopeAtPosition(requestScopes, position, requestUri);
        const accessibleDefinitions = candidates.filter(candidate => this.isSymbolAccessible(candidate, requestScope, requestUri));
        return accessibleDefinitions.map(def => def.location);
    }
    //Todo: Expand to Workspace
    isSymbolAccessible(symbol, requestScope, requestUri) {
        // Same document and same or child scope
        if (symbol.location.uri === requestUri &&
            this.isSameOrChildScope(requestScope, symbol.scope)) {
            return true;
        }
        // Global symbols accessible from anywhere
        return symbol.visibility === 'global';
    }
    isSameOrChildScope(child, parent) {
        let current = child;
        while (current) {
            if (current === parent) {
                return true;
            }
            current = current.parentScope;
        }
        return false;
    }
    getScopeAtPosition(scopes, position, documentUri) {
        //filter scopes for the current document
        const documentScopes = scopes.filter(s => s.documentUri === documentUri);
        let currentScope = documentScopes.find(s => s.type === 'global') || dataflexScopes_1.ScopeFactory.createGlobalScope(0, documentUri);
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
    clearDocumentSymbols(uri) {
        this.symbolIndex.forEach((symbols, key) => {
            this.symbolIndex.set(key, symbols.filter(s => s.location.uri !== uri));
        });
        this.documentScopes.delete(uri);
    }
}
exports.DefinitionFinder = DefinitionFinder;
//# sourceMappingURL=DefinitionFinder.js.map