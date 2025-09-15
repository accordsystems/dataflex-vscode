"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexValidator = void 0;
const node_1 = require("vscode-languageserver/node");
const dataflexKeywords_1 = require("../common/dataflexKeywords");
class DataFlexValidator {
    //function to return all diagnostics
    static validateDocument(document) {
        const diagnostics = [];
        //diagnostics.push(...this.validateLongLines(document));
        //diagnostics.push(...this.validateProcedureCasing(document));
        diagnostics.push(...this.validateKeywordCasing(document));
        return diagnostics;
    }
    // Validate incorrect casing for multiple keywords - Performance optimized
    static validateKeywordCasing(document) {
        const diagnostics = [];
        const lines = document.getText().split(/\r?\n/);
        // Precompile all regex patterns once
        const keywordRegexes = (0, dataflexKeywords_1.getAllKeywordRegexes)();
        //Process Each Line
        lines.forEach((lineText, lineNumber) => {
            //Iterate through each Keyword Regex and scan for a match
            keywordRegexes.forEach(([casedKeyword, regex]) => {
                // Reset regex state for each line                
                regex.lastIndex = 0;
                let match;
                while ((match = regex.exec(lineText)) !== null && match[0].trim() !== casedKeyword) {
                    const keywordStartOffset = match[0].search(/\S/); // Find first non-whitespace character
                    const start = { line: lineNumber, character: match.index + keywordStartOffset };
                    const end = { line: lineNumber, character: match.index + match[0].length };
                    diagnostics.push({
                        severity: node_1.DiagnosticSeverity.Warning,
                        range: { start, end },
                        message: `Keyword '${match[0].trim()}' should be capitalized as '${casedKeyword}'.`,
                        source: 'casing'
                    });
                }
            });
        });
        return diagnostics;
    }
}
exports.DataFlexValidator = DataFlexValidator;
//# sourceMappingURL=DataFlexValidator.js.map