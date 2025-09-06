import { DataFlexSymbols } from "../Symbols/dataflexSymbols";

export const DATAFLEX_SCOPE_TYPES = {
    procedure: DataFlexSymbols.procedure,
    function: DataFlexSymbols.function,
    class: DataFlexSymbols.class,
    object: DataFlexSymbols.object,
    command : DataFlexSymbols.command,
    global : 'Global'
} as const;

export const DATAFLEX_SCOPE_BEGIN_SYMBOLS = {
    ...DATAFLEX_SCOPE_TYPES
} as const;

export const DATAFLEX_SCOPE_END_SYMBOLS = {
    end_procedure: 'End_Procedure',
    end_function: 'End_Function',
    end_class: 'End_Class',
    end_object: 'End_Object',
    end_command: '#END_COMMAND'
} as const;

export interface ScopeInfo {
    name: string;
    type: keyof typeof DATAFLEX_SCOPE_TYPES;  // References the shared constants
    startLine: number;
    endLine: number;
    documentUri: string;
    parentScope: ScopeInfo | null; // Reference to the parent scope, null if global
}

export class ScopeFactory {
    static createGlobalScope(lines: number, documentUri: string): ScopeInfo {
        return {
            name: 'Global Scope',
            type: 'global',
            startLine: 0,
            endLine: lines - 1,
            documentUri: documentUri,
            parentScope: null
        };
    }
}
