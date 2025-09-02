"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATAFLEX_FILE_EXTENSIONS = exports.DATAFLEX_KEYWORDS = void 0;
exports.DATAFLEX_KEYWORDS = {
    CONTROL: ['Procedure', 'End_Procedure', 'Function', 'End_Function', 'Begin', 'End', 'Use', '#INCLUDE', '#IFDEF', '#ENDIF', '#ELSE', '#IFNDEF', '#COMMAND', '#ENDCOMMAND'],
    DECLARATION: ['String', 'Number', 'Integer', 'Date', 'DateTime',
        'Property',
        'Global_Variable', 'Local_Variable',
        'Define',
        'Object', 'End_Object',
        'Class', 'End_Class',
        'Struct', 'End_Struct'],
    LOOP: ['For', 'Loop', 'While', 'Until', 'Repeat'],
    CONDITIONAL: ['If', 'Else', 'Else If', 'Case', 'Break'],
    ACCESS: ['Move', 'Get', 'Set', 'Send', 'to', 'from'],
    OPERATORS: ['Max', 'Min', 'Not', 'And', 'Or', 'Iand', 'Ior', '=', '<>', '<', '>', '<=', '>=', 'Contains', 'Matches']
};
exports.DATAFLEX_FILE_EXTENSIONS = [
    '.src', '.vw', '.sl', '.dg', '.rv', '.dd', '.bp', '.pkg', '.wo', '.dd', '.inc', '.tpl', '.dfo'
];
