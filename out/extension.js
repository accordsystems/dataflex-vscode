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
const vscode = __importStar(require("vscode"));
const DATAFLEX_KEYWORDS = {
    CONTROL: ['Procedure', 'End_Procedure', 'Function', 'End_Function', 'Begin', 'End'],
    DECLARATION: ['String', 'Number', 'Integer', 'Date', 'DateTime',
        'Property',
        'Global_Variable', 'Local_Variable',
        'Define',
        'Object', 'End_Object',
        'Class', 'End_Class',
        'Struct', 'End_Struct'],
    LOOP: ['For', 'Loop', 'While', 'Until', 'Repeat'],
    CONDITIONAL: ['If', 'Else', 'Else If', 'Case', 'Break'],
    ACCESS: ['Move', 'Get', 'Set', 'Send', 'to', 'from'],
    OPERATORS: ['Max', 'Min', 'Not', 'And', 'Or', 'Iand', 'Ior', '=', '<>', '<', '>', '<=', '>=', 'Contains', 'Matches']
};
const DATAFLEX_FILE_EXTENSIONS = [
    '.src', '.vw', '.sl', '.dg', '.rv', '.dd', '.bp', '.pkg', '.wo', '.dd', '.inc', '.tpl', '.dfo'
];
function activate(context) {
    const definitionProvider = vscode.languages.registerDefinitionProvider('dataflex', {
        provideDefinition: (document, position, token) => __awaiter(this, void 0, void 0, function* () {
            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);
            if (word) {
                const definitionLocation = yield findDefinition(word, document, position);
                if (definitionLocation) {
                    return definitionLocation;
                }
            }
            return null;
        })
    });
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider({ language: 'dataflex' }, new DataFlexDocumentSymbolProvider());
    context.subscriptions.push(definitionProvider);
    const config = vscode.workspace.getConfiguration();
    // Check if the encoding for `.src` files is already set
    const encoding = config.get('files.encoding');
    const associations = config.get('files.associations');
    if (encoding !== 'cp437' || !associations || associations['*.src'] !== 'dataflex') {
        vscode.window.showInformationMessage('It is recommended to set the encoding for `.src` files to cp437 and associate them with the Dataflex language. Add the following to your settings.json:\n\n' +
            `"files.encoding": "cp437",\n` +
            `"files.associations": {\n` +
            `  "*.src": "dataflex"\n` +
            `}`);
    }
}
// This class provides the DocumentSymbolProvider for DataFlex files (The Outline view)
// It will provide symbols for classes, functions, procedures, commands, and labels
// It will also provide a symbol for the start and end of the file
class DataFlexDocumentSymbolProvider {
    provideDocumentSymbols(document, token) {
        const symbols = [];
        const lines = document.getText().split('\n');
        const classStack = []; // Stack to track nested classes
        const objectStack = []; // Stack to track nested objects        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Match Classes
            const classMatch = line.match(/^Class\s+(\w+)/);
            if (classMatch) {
                const className = classMatch[1];
                const classSymbol = new vscode.DocumentSymbol(className, 'Class', vscode.SymbolKind.Class, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                if (classStack.length > 0) {
                    // Add this class as a child of the current class on the stack
                    classStack[classStack.length - 1].children.push(classSymbol);
                }
                else {
                    // Add this class to the top-level symbols
                    symbols.push(classSymbol);
                }
                classStack.push(classSymbol); // Push the current class onto the stack
                continue;
            }
            // Match End_Class
            const endClassMatch = line.match(/^End_Class/);
            if (endClassMatch) {
                if (classStack.length > 0) {
                    // Pop the current class from the stack
                    const completedClass = classStack.pop();
                    if (completedClass) {
                        // Update the range to include the end of the class
                        completedClass.range = new vscode.Range(completedClass.range.start, new vscode.Position(i, line.length));
                    }
                }
                continue;
            }
            // Match Objects
            const objectMatch = line.match(/^Object\s+(\w+)\s+is\s+a[n]?\s+(\w+)/);
            if (objectMatch) {
                const objectName = objectMatch[1];
                const className = objectMatch[2];
                const objectSymbol = new vscode.DocumentSymbol(objectName, `Object of type ${className}`, vscode.SymbolKind.Object, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                if (objectStack.length > 0) {
                    // Add this object as a child of the current object on the stack
                    objectStack[objectStack.length - 1].children.push(objectSymbol);
                }
                else if (classStack.length > 0) {
                    // Add this object as a child of the current class
                    classStack[classStack.length - 1].children.push(objectSymbol);
                }
                else {
                    // Add this object to the top-level symbols
                    symbols.push(objectSymbol);
                }
                objectStack.push(objectSymbol); // Push the current object onto the stack
                continue;
            }
            // Match End_Object
            const endObjectMatch = line.match(/^End_Object/);
            if (endObjectMatch) {
                if (objectStack.length > 0) {
                    // Pop the current object from the stack
                    const completedObject = objectStack.pop();
                    if (completedObject) {
                        // Update the range to include the end of the object
                        completedObject.range = new vscode.Range(completedObject.range.start, new vscode.Position(i, line.length));
                    }
                }
                continue;
            }
            // Match Functions
            const functionMatch = line.match(/^Function\s+(\w+)/);
            if (functionMatch) {
                const functionName = functionMatch[1];
                const functionSymbol = new vscode.DocumentSymbol(functionName, 'Function', vscode.SymbolKind.Function, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                if (objectStack.length > 0) {
                    // Add this function as a child of the current object
                    objectStack[objectStack.length - 1].children.push(functionSymbol);
                }
                else if (classStack.length > 0) {
                    // Add this function as a child of the current class
                    classStack[classStack.length - 1].children.push(functionSymbol);
                }
                else {
                    // Add this function to the top-level symbols
                    symbols.push(functionSymbol);
                }
                continue;
            }
            // Match Procedures
            const procedureMatch = line.match(/^Procedure\s+(\w+)/);
            if (procedureMatch) {
                const procedureName = procedureMatch[1];
                const procedureSymbol = new vscode.DocumentSymbol(procedureName, 'Procedure', vscode.SymbolKind.Method, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                if (objectStack.length > 0) {
                    // Add this procedure as a child of the current object
                    objectStack[objectStack.length - 1].children.push(procedureSymbol);
                }
                else if (classStack.length > 0) {
                    // Add this procedure as a child of the current class
                    classStack[classStack.length - 1].children.push(procedureSymbol);
                }
                else {
                    // Add this procedure to the top-level symbols
                    symbols.push(procedureSymbol);
                }
                continue;
            }
            // Match Commands
            // Commands Take the Form of #COMMAND <commandName> and #END_COMMAND
            const commandMatch = line.match(/^#COMMAND\s+([^\s]+)/); // Updated regex to match any non-whitespace characters
            if (commandMatch) {
                const commandName = commandMatch[1];
                const commandSymbol = new vscode.DocumentSymbol(commandName, 'Command', vscode.SymbolKind.Method, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                symbols.push(commandSymbol);
                continue;
            }
            // Match Labels
            // labels take the form of <labelName>: and are used for goto statements
            const labelRegex = "^\\s*\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b:"; // leading whitespace, label name, colon example: "label1:" or "  label1:"
            const labelMatch = line.match(labelRegex);
            if (labelMatch) {
                const labelName = labelMatch[1];
                const labelSymbol = new vscode.DocumentSymbol(labelName, 'Label', vscode.SymbolKind.String, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                symbols.push(labelSymbol);
                continue;
            }
            //Match Structs
            // Structs take the form of Struct <structName> and End_Struct
            // Example: Struct MyStruct
            // End_Struct closes the Struct
            const structMatch = line.match(/^Struct\s+(\w+)/);
            if (structMatch) {
                const structName = structMatch[1];
                const structSymbol = new vscode.DocumentSymbol(structName, 'Struct', vscode.SymbolKind.Struct, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                symbols.push(structSymbol);
                continue;
            }
            // Match Screens
            const screenMatch = line.match(/^\/screen(\w+)/);
            if (screenMatch) {
                const screenName = screenMatch[1];
                const screenSymbol = new vscode.DocumentSymbol(screenName, 'Screen', vscode.SymbolKind.Struct, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)), new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                symbols.push(screenSymbol);
                continue;
            }
        }
        return symbols;
    }
}
function findDefinition(word, document, position) {
    return __awaiter(this, void 0, void 0, function* () {
        // Await the result of findFiles
        const workspaceFiles = yield vscode.workspace.findFiles(`**/*{${DATAFLEX_FILE_EXTENSIONS.join(',')}}`); // Await the Promise
        const exactMatchRegex = new RegExp(`\\b(${DATAFLEX_KEYWORDS.CONTROL.join('|')}\\s+${word}\\b`); // Match exact class or function name
        for (const file of workspaceFiles) {
            const fileContent = yield vscode.workspace.openTextDocument(file); // Await the Promise
            const lines = fileContent.getText().split('\n');
            // Checks for global Symbols defined in exactMatchRegex
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (exactMatchRegex.test(line)) {
                    return new vscode.Location(fileContent.uri, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                }
                //Now Check for variables and params in scope
                const functionScope = isWithinFunctionProcedureScope(position, lines, i);
                if (functionScope.inScope) {
                    const variables = extractVariablesAndParameters(lines, functionScope.functionStartLine, functionScope.functionEndLine);
                    if (variables.includes(word)) {
                        return new vscode.Location(fileContent.uri, new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)));
                    }
                }
            }
        }
        return null;
    });
}
//Determines if a line is within a scope of a Function or Procedure
//Needs Testing
function isWithinFunctionProcedureScope(position, lines, currentLine) {
    let inFunction = false;
    let functionStartLine = -1;
    let functionEndLine = -1;
    // Go Back to find the start of the function or procedure
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('Function') || line.startsWith('Procedure')) {
            inFunction = true;
            functionStartLine = i;
            break;
        }
    }
    // Go forward to find the end of the function or procedure
    for (let i = currentLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('End_Function') || line.startsWith('End_Procedure')) {
            functionEndLine = i;
            break;
        }
    }
    // Check if the word is within the function or procedure scope
    if (inFunction && functionStartLine !== -1 && functionEndLine !== -1) {
        const functionRange = new vscode.Range(new vscode.Position(functionStartLine, 0), new vscode.Position(functionEndLine, lines[functionEndLine].length));
        inFunction = functionRange.contains(position);
    }
    return { inScope: inFunction, functionStartLine, functionEndLine };
}
//Need to Test
function extractVariablesAndParameters(lines, functionStartLine, functionEndLine) {
    const variables = [];
    for (let i = functionStartLine; i <= functionEndLine; i++) {
        const line = lines[i].trim();
        // Match parameters in the function or procedure signature
        const paramMatch = line.match(/(Function|Procedure)\s+\w+\s+([^:]+)/);
        if (paramMatch) {
            const params = paramMatch[2].split(/\s+/); // Split parameters by spaces
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
function deactivate() {
    // Nothing to cleanup at the moment
}
module.exports = {
    activate,
    deactivate
};
