"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexDefinitionProvider = void 0;
const vscode = require("vscode");
const constants_1 = require("../constants/constants");
const fileAssociations_1 = require("../settings/fileAssociations");
class DataFlexDefinitionProvider {
    async provideDefinition(document, position, token) {
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
    async findDefinition(word, document, position) {
        const allExtensions = [...constants_1.DATAFLEX_FILE_EXTENSIONS, ...(0, fileAssociations_1.getAdditionalExtensions)()];
        const workspaceFiles = await vscode.workspace.findFiles(`**/*{${allExtensions.join(',')}}`);
        const exactMatchRegex = new RegExp(`\\b(${constants_1.DATAFLEX_KEYWORDS.CONTROL.join('|')}\\s+${word}\\b`);
        for (const file of workspaceFiles) {
            const fileContent = await vscode.workspace.openTextDocument(file);
            const lines = fileContent.getText().split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (exactMatchRegex.test(line)) {
                    return new vscode.Location(fileContent.uri, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                }
                const functionScope = this.isWithinFunctionProcedureScope(position, lines, i);
                if (functionScope.inScope) {
                    const variables = this.extractVariablesAndParameters(lines, functionScope.functionStartLine, functionScope.functionEndLine);
                    if (variables.includes(word)) {
                        return new vscode.Location(fileContent.uri, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                    }
                }
            }
        }
        return null;
    }
    isWithinFunctionProcedureScope(position, lines, currentLine) {
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
            const functionRange = new vscode.Range(new vscode.Position(functionStartLine, 0), new vscode.Position(functionEndLine, lines[functionEndLine].length));
            inFunction = functionRange.contains(position);
        }
        return { inScope: inFunction, functionStartLine, functionEndLine };
    }
    extractVariablesAndParameters(lines, functionStartLine, functionEndLine) {
        const variables = [];
        for (let i = functionStartLine; i <= functionEndLine; i++) {
            const line = lines[i].trim();
            const paramMatch = line.match(/(Function|Procedure)\s+\w+\s+([^:]+)/);
            if (paramMatch) {
                const params = paramMatch[2].split(/\s+/);
                variables.push(...params);
            }
            const declarationRegex = new RegExp(`\\b(${constants_1.DATAFLEX_KEYWORDS.DECLARATION.join('|')})\\s+(\\w+)`);
            const variableMatch = line.match(declarationRegex);
            if (variableMatch) {
                variables.push(variableMatch[2]);
            }
        }
        return variables;
    }
}
exports.DataFlexDefinitionProvider = DataFlexDefinitionProvider;
//# sourceMappingURL=dataflexDefinitionProvider.js.map