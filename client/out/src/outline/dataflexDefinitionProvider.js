"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexDefinitionProvider = void 0;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../constants/constants");
class DataFlexDefinitionProvider {
    provideDefinition(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);
            if (word) {
                const definitionLocation = yield this.findDefinition(word, document, position);
                if (definitionLocation) {
                    return definitionLocation;
                }
            }
            return null;
        });
    }
    findDefinition(word, document, position) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspaceFiles = yield vscode.workspace.findFiles(`**/*{${constants_1.DATAFLEX_FILE_EXTENSIONS.join(',')}}`);
            const exactMatchRegex = new RegExp(`\\b(${constants_1.DATAFLEX_KEYWORDS.CONTROL.join('|')}\\s+${word}\\b`);
            for (const file of workspaceFiles) {
                const fileContent = yield vscode.workspace.openTextDocument(file);
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
        });
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
