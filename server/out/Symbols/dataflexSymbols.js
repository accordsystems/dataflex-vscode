"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexSymbols = void 0;
exports.isVariableType = isVariableType;
const dataflexVariables_1 = require("../common/dataflexVariables");
exports.DataFlexSymbols = {
    procedure: 'Procedure',
    function: 'Function',
    class: 'Class',
    object: 'Object',
    property: 'Property',
    command: '#COMMAND',
    define: 'Define',
    ...dataflexVariables_1.DATAFLEX_VARIABLES
};
// Helper function to check if a symbol type is a variable type
function isVariableType(symbolType) {
    return symbolType in dataflexVariables_1.DATAFLEX_VARIABLES;
}
//# sourceMappingURL=dataflexSymbols.js.map