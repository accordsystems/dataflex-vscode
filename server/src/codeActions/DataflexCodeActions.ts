import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { CodeAction, CodeActionKind, TextEdit } from 'vscode-languageserver/node';

export class DataFlexCodeActions {
  /**
   * Returns CodeActions for correcting 'procedure' and 'function' in the given range.
   */
  public static getCodeActions(document: TextDocument, range: { start: { line: number, character: number }, end: { line: number, character: number } }): CodeAction[] {
    const selectedText = document.getText(range);
    const actions: CodeAction[] = [];
    actions.push(...this.suggestProcedure(document, selectedText, range));
    actions.push(...this.suggestFunction(document, selectedText, range));

    return actions;
  }

  /**
   * Returns TextEdits to correct lowercase 'procedure' to 'Procedure' on the given line.
   */
  private static suggestProcedure(document : TextDocument, lineText: string, range: Range): CodeAction[] {

    const actions: CodeAction[] = [];
    //1. Stops if it is "Procedure". Then Matches any casing of Procedure
    const regex = /\b(?!Procedure\b)[Pp][Rr][Oo][Cc][Ee][Dd][Uu][Rr][Ee]\b/g;
    if (lineText.match(regex)) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const start = { line: range.start.line, character: match.index };
        const end = { line: range.start.line, character: match.index + match[0].length };
        const edit: TextEdit = {
          range: { start, end },
          newText: 'Procedure'
        };
        actions.push({
          title: "Change 'procedure' to 'Procedure'",
          kind: CodeActionKind.QuickFix,
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
  private static suggestFunction(document : TextDocument, lineText: string, range: Range): CodeAction[] {

    const actions: CodeAction[] = [];
    //1. Stops if it is "Function". Then Matches any casing of Function
    const regex = /\b(?!Function\b)[Ff][Uu][Nn][Cc][Tt][Ii][Oo][Nn]\b/g;
    if (lineText.match(regex)) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const start = { line: range.start.line, character: match.index };
        const end = { line: range.start.line, character: match.index + match[0].length };
        const edit: TextEdit = {
          range: { start, end },
          newText: 'Function'
        };
        actions.push({
          title: "Change 'function' to 'Function'",
          kind: CodeActionKind.QuickFix,
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