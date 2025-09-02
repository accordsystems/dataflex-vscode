import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';
import { Range } from 'vscode-languageserver/node';

export class AutoCorrector {
  /**
   * Returns TextEdits to autocorrect the last line of the document.
   * Calls all available autocorrection methods.
   */
  public static autocorrectTextDocument(document: TextDocument): TextEdit[] {
    const lastLine = document.lineCount - 1;
    const lineText = document.getText({
      start: { line: lastLine, character: 0 },
      end: { line: lastLine, character: Number.MAX_SAFE_INTEGER }
    });

    const edits: TextEdit[] = [];
    edits.push(...this.correctProcedure(lineText, lastLine));
    edits.push(...this.correctFunction(lineText, lastLine));

    return edits;
  }

  /**
   * Returns TextEdits to correct lowercase 'procedure' to 'Procedure' on the given line.
   */
  private static correctProcedure(lineText: string, lineNumber: number): TextEdit[] {
    const regex = /\bprocedure\b/g; // Match whole word 'procedure' 
    let match: RegExpExecArray | null;
    const edits: TextEdit[] = [];
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
  private static correctFunction(lineText: string, lineNumber: number): TextEdit[] {
    const regex = /\bfunction\b/g;
    let match: RegExpExecArray | null;
    const edits: TextEdit[] = [];
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