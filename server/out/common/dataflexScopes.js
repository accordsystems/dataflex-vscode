"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeFactory = exports.DATAFLEX_SCOPE_END_SYMBOLS = exports.DATAFLEX_SCOPE_BEGIN_SYMBOLS = exports.DATAFLEX_SCOPE_TYPES = void 0;
const dataflexSymbols_1 = require("../Symbols/dataflexSymbols");
exports.DATAFLEX_SCOPE_TYPES = {
    procedure: dataflexSymbols_1.DataFlexSymbols.procedure,
    function: dataflexSymbols_1.DataFlexSymbols.function,
    class: dataflexSymbols_1.DataFlexSymbols.class,
    object: dataflexSymbols_1.DataFlexSymbols.object,
    command: dataflexSymbols_1.DataFlexSymbols.command,
    global: 'Global'
};
exports.DATAFLEX_SCOPE_BEGIN_SYMBOLS = {
    ...exports.DATAFLEX_SCOPE_TYPES
};
exports.DATAFLEX_SCOPE_END_SYMBOLS = {
    end_procedure: 'End_Procedure',
    end_function: 'End_Function',
    end_class: 'End_Class',
    end_object: 'End_Object',
    end_command: '#END_COMMAND'
};
class ScopeFactory {
    static createGlobalScope(lines, documentUri) {
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
exports.ScopeFactory = ScopeFactory;
//# sourceMappingURL=dataflexScopes.js.map