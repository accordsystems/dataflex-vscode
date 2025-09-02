import * as vscode from 'vscode';
import { DATAFLEX_KEYWORDS, DATAFLEX_FILE_EXTENSIONS } from '../constants/constants';

export class DataFlexDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | null> {
        const wordRange = document.getWordRangeAtPosition(position);
        const word = document.getText(wordRange);

        if (word) {
            const definitionLocation = await this.findDefinition(word, document, position);
            if (definitionLocation) {
                return definitionLocation;
            }
        }

        return null;
    }    
    

    async findDefinition(word: string, document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | null> {
        const workspaceFiles = await vscode.workspace.findFiles(`**/*{${DATAFLEX_FILE_EXTENSIONS.join(',')}}`);
        const exactMatchRegex = new RegExp(`\\b(${DATAFLEX_KEYWORDS.CONTROL.join('|')}\\s+${word}\\b`);

        for (const file of workspaceFiles) {
            const fileContent = await vscode.workspace.openTextDocument(file);
            const lines = fileContent.getText().split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (exactMatchRegex.test(line)) {
                    return new vscode.Location(
                        fileContent.uri,
                        new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                    );
                }

                const functionScope = this.isWithinFunctionProcedureScope(position, lines, i);
                if (functionScope.inScope) {
                    const variables = this.extractVariablesAndParameters(lines, functionScope.functionStartLine, functionScope.functionEndLine);
                    if (variables.includes(word)) {
                        return new vscode.Location(
                            fileContent.uri,
                            new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                        );
                    }
                }
            }
        }
        return null;
    }

    isWithinFunctionProcedureScope(position: vscode.Position, lines: string[], currentLine: number): { inScope: boolean; functionStartLine: number; functionEndLine: number } {
        let inFunction = false;
        let functionStartLine = -1;
        let functionEndLine = -1;

        for (let i = currentLine; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('Function') || line.startsWith('Procedure')) {
                inFunction = true;
                functionStartLine = i;
                break;
            }
        }
        for (let i = currentLine; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('End_Function') || line.startsWith('End_Procedure')) {
                functionEndLine = i;
                break;
            }
        }
        if (inFunction && functionStartLine !== -1 && functionEndLine !== -1) {
            const functionRange = new vscode.Range(
                new vscode.Position(functionStartLine, 0),
                new vscode.Position(functionEndLine, lines[functionEndLine].length)
            );
            inFunction = functionRange.contains(position);
        }
        return { inScope: inFunction, functionStartLine, functionEndLine };
    }

    extractVariablesAndParameters(lines: string[], functionStartLine: number, functionEndLine: number): string[] {
        const variables: string[] = [];
        for (let i = functionStartLine; i <= functionEndLine; i++) {
            const line = lines[i].trim();
            const paramMatch = line.match(/(Function|Procedure)\s+\w+\s+([^:]+)/);
            if (paramMatch) {
                const params = paramMatch[2].split(/\s+/);
                variables.push(...params);
            }
            const declarationRegex = new RegExp(`\\b(${DATAFLEX_KEYWORDS.DECLARATION.join('|')})\\s+(\\w+)`);
            const variableMatch = line.match(declarationRegex);
            if (variableMatch) {
                variables.push(variableMatch[2]);
            }
        }
        return variables;
    }
}





