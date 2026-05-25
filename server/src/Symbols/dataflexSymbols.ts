import { Location } from 'vscode-languageserver/node';
import { DATAFLEX_VARIABLES } from '../common/dataflexVariables';

import type { ScopeInfo } from '../common/dataflexScopes';

export const DataFlexSymbols = {
    procedure: 'Procedure',
    function: 'Function',
    class: 'Class',
    object: 'Object',
    property: 'Property',
    command: '#COMMAND',
    define: 'Define',
    ...DATAFLEX_VARIABLES
} as const; 

export type DataFlexSymbolType = keyof typeof DataFlexSymbols;

export interface SymbolDefinition {
    name: string;
    type: DataFlexSymbolType;
    location: Location;    
    visibility: 'public' | 'private' | 'protected' | 'global';
    scope: ScopeInfo; // The scope in which this symbol is defined
}

// Helper function to check if a symbol type is a variable type
export function isVariableType(symbolType: DataFlexSymbolType): symbolType is keyof typeof DATAFLEX_VARIABLES {
    return symbolType in DATAFLEX_VARIABLES;
}