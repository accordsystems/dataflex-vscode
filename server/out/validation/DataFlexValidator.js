"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexValidator = void 0;
const node_1 = require("vscode-languageserver/node");
const KEYWORD_MAP = {
    procedure: 'Procedure',
    function: 'Function',
    end_procedure: 'End_Procedure',
    end_function: 'End_Function',
    function_return: 'Function_Return',
    procedure_return: 'Procedure_Return',
    command: '#COMMAND',
    end_command: '#END_COMMAND',
    ifdef: '#IFDEF',
    endifdef: '#ENDIF',
    elseifdef: '#ELSEIF'
};
class DataFlexValidator {
    //function to return all diagnostics
    static validateDocument(document) {
        const diagnostics = [];
        //diagnostics.push(...this.validateLongLines(document));
        //diagnostics.push(...this.validateProcedureCasing(document));
        diagnostics.push(...this.validateKeywordCasing(document, Object.values(KEYWORD_MAP)));
        return diagnostics;
    }
    // Validate incorrect casing for multiple keywords
    static validateKeywordCasing(document, keywords) {
        const diagnostics = [];
        const text = document.getText();
        keywords.forEach(keyword => {
            // Step 1: Create negative lookahead to exclude correct casing ie. (?!Procedure\b)
            const negativeLookahead = `(?!${keyword}\\b)`;
            // Step 2: Create case-insensitive character classes for each letter ie. [Pp][Rr][Oo][Cc][Ee][Dd][Uu][Rr][Ee]
            const caseInsensitivePattern = keyword.split('').map(c => `[${c.toLowerCase()}${c.toUpperCase()}]`).join('');
            // Step 3: Combine with word boundaries
            const fullPattern = `\\b${negativeLookahead}${caseInsensitivePattern}\\b`; // (?!Procedure\b)[Pp][Rr][Oo][Cc][Ee][Dd][Uu][Rr][Ee]
            // Step 4: Create the final regex with global flag
            const regex = new RegExp(fullPattern, 'g');
            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = document.positionAt(match.index);
                const end = document.positionAt(match.index + match[0].length);
                diagnostics.push({
                    severity: node_1.DiagnosticSeverity.Warning,
                    range: { start, end },
                    message: `Keyword '${match[0]}' should be capitalized as '${keyword}'.`,
                    source: 'casing'
                });
            }
        });
        return diagnostics;
    }
}
exports.DataFlexValidator = DataFlexValidator;
//# sourceMappingURL=DataFlexValidator.js.map