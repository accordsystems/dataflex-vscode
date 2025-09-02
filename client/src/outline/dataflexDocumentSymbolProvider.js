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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlexDocumentSymbolProvider = void 0;
const vscode = __importStar(require("vscode"));
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
exports.DataFlexDocumentSymbolProvider = DataFlexDocumentSymbolProvider;
//# sourceMappingURL=dataflexDocumentSymbolProvider.js.map