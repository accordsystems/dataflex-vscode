"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexCodeActions = void 0;
const node_1 = require("vscode-languageserver/node");
class DataFlexCodeActions {
    /**
     * Returns CodeActions for correcting 'procedure' and 'function' in the given range.
     */
    static getCodeActions(document, range) {
        const selectedText = document.getText(range);
        const actions = [];
        actions.push(...this.suggestProcedure(document, selectedText, range));
        actions.push(...this.suggestFunction(document, selectedText, range));
        return actions;
    }
    /**
     * Returns TextEdits to correct lowercase 'procedure' to 'Procedure' on the given line.
     */
    static suggestProcedure(document, lineText, range) {
        const actions = [];
        //1. Stops if it is "Procedure". Then Matches any casing of Procedure
        const regex = /\b(?!Procedure\b)[Pp][Rr][Oo][Cc][Ee][Dd][Uu][Rr][Ee]\b/g;
        if (lineText.match(regex)) {
            let match;
            while ((match = regex.exec(lineText)) !== null) {
                const start = { line: range.start.line, character: match.index };
                const end = { line: range.start.line, character: match.index + match[0].length };
                const edit = {
                    range: { start, end },
                    newText: 'Procedure'
                };
                actions.push({
                    title: "Change 'procedure' to 'Procedure'",
                    kind: node_1.CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri]: [edit]
                        }
                    }
                });
            }
        }
        return actions;
    }
    /**
     * Returns TextEdits to correct lowercase 'procedure' to 'Procedure' on the given line.
     */
    static suggestFunction(document, lineText, range) {
        const actions = [];
        //1. Stops if it is "Function". Then Matches any casing of Function
        const regex = /\b(?!Function\b)[Ff][Uu][Nn][Cc][Tt][Ii][Oo][Nn]\b/g;
        if (lineText.match(regex)) {
            let match;
            while ((match = regex.exec(lineText)) !== null) {
                const start = { line: range.start.line, character: match.index };
                const end = { line: range.start.line, character: match.index + match[0].length };
                const edit = {
                    range: { start, end },
                    newText: 'Function'
                };
                actions.push({
                    title: "Change 'function' to 'Function'",
                    kind: node_1.CodeActionKind.QuickFix,
                    edit: {
                        changes: {
                            [document.uri]: [edit]
                        }
                    }
                });
            }
        }
        return actions;
    }
}
exports.DataFlexCodeActions = DataFlexCodeActions;
//# sourceMappingURL=DataflexCodeActions.js.map