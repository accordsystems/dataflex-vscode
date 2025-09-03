"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCorrector = void 0;
class AutoCorrector {
    /**
     * Returns TextEdits to autocorrect the last line of the document.
     * Calls all available autocorrection methods.
     */
    static autocorrectCurrentLine(document, cursorLine) {
        const lineText = document.getText({
            start: { line: cursorLine, character: 0 },
            end: { line: cursorLine, character: Number.MAX_SAFE_INTEGER }
        });
        const edits = [];
        edits.push(...this.correctProcedure(lineText, cursorLine));
        edits.push(...this.correctFunction(lineText, cursorLine));
        return edits;
    }
    /**
     * Returns TextEdits to correct lowercase 'procedure' to 'Procedure' on the given line.
     */
    static correctProcedure(lineText, lineNumber) {
        const regex = /\bprocedure\b/g; // Match whole word 'procedure' 
        let match;
        const edits = [];
        while ((match = regex.exec(lineText)) !== null) {
            const start = { line: lineNumber, character: match.index };
            const end = { line: lineNumber, character: match.index + match[0].length };
            edits.push({
                range: { start, end },
                newText: 'Procedure'
            });
        }
        return edits;
    }
    /**
     * Returns TextEdits to correct lowercase 'function' to 'Function' on the given line.
     */
    static correctFunction(lineText, lineNumber) {
        const regex = /\bfunction\b/g;
        let match;
        const edits = [];
        while ((match = regex.exec(lineText)) !== null) {
            const start = { line: lineNumber, character: match.index };
            const end = { line: lineNumber, character: match.index + match[0].length };
            edits.push({
                range: { start, end },
                newText: 'Function'
            });
        }
        return edits;
    }
}
exports.AutoCorrector = AutoCorrector;
//# sourceMappingURL=autoCorrects.js.map