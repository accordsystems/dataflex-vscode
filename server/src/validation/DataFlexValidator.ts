import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { getAllKeywordRegexes } from '../common/dataflexKeywords'
export class DataFlexValidator {

    //function to return all diagnostics
    static validateDocument(document: TextDocument): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        //diagnostics.push(...this.validateLongLines(document));
        //diagnostics.push(...this.validateProcedureCasing(document));
        diagnostics.push(...this.validateKeywordCasing(document));
        return diagnostics;
    }

    // Validate incorrect casing for multiple keywords - Performance optimized
    static validateKeywordCasing(document: TextDocument): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        const lines: string[] = document.getText().split(/\r?\n/);

        // Precompile all regex patterns once
        const keywordRegexes = getAllKeywordRegexes();
        
        //Process Each Line
        lines.forEach((lineText, lineNumber) => {
            //Iterate through each Keyword Regex and scan for a match
            keywordRegexes.forEach(([casedKeyword, regex]) => {
                // Reset regex state for each line                
                regex.lastIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = regex.exec(lineText)) !== null && match[0].trim() !== casedKeyword) {
                    const start = { line: lineNumber, character: match.index };
                    const end = { line: lineNumber, character: match.index + match[0].length };
                    diagnostics.push({
                        severity: DiagnosticSeverity.Warning,
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