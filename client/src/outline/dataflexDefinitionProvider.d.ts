import * as vscode from 'vscode';
export declare class DataFlexDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | null>;
    findDefinition(word: string, document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | null>;
    isWithinFunctionProcedureScope(position: vscode.Position, lines: string[], currentLine: number): {
        inScope: boolean;
        functionStartLine: number;
        functionEndLine: number;
    };
    extractVariablesAndParameters(lines: string[], functionStartLine: number, functionEndLine: number): string[];
}
//# sourceMappingURL=dataflexDefinitionProvider.d.ts.map