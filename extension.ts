import * as vscode from 'vscode';

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

function activate(context: vscode.ExtensionContext) {
    const definitionProvider = vscode.languages.registerDefinitionProvider('dataflex', {
        provideDefinition: async (document, position, token) => {
            const wordRange = document.getWordRangeAtPosition(position);
            const word = document.getText(wordRange);

            if (word) {
                const definitionLocation = await findDefinition(word, document, position);
                if (definitionLocation) {
                    return definitionLocation;
                }
            }

            return null;
        }
    });

    const symbolProvider = vscode.languages.registerDocumentSymbolProvider(
        {language: 'dataflex'},
        new DataFlexDocumentSymbolProvider()
    );    

    context.subscriptions.push(definitionProvider);
    const config = vscode.workspace.getConfiguration();
    // Check if the encoding for `.src` files is already set
    const encoding = config.get<string>('files.encoding');
    const associations = config.get<{ [key: string]: string }>('files.associations');

    if (encoding !== 'cp437' || !associations || associations['*.src'] !== 'dataflex') {
        vscode.window.showInformationMessage(
            'It is recommended to set the encoding for `.src` files to cp437 and associate them with the Dataflex language. Add the following to your settings.json:\n\n' +
            `"files.encoding": "cp437",\n` +
            `"files.associations": {\n` +
            `  "*.src": "dataflex"\n` +
            `}`
        );
    }
}

// This class provides the DocumentSymbolProvider for DataFlex files (The Outline view)
// It will provide symbols for classes, functions, procedures, commands, and labels
// It will also provide a symbol for the start and end of the file
class DataFlexDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        
        const symbols: vscode.DocumentSymbol[] = [];
        const lines = document.getText().split('\n');
        const objectStack: vscode.DocumentSymbol[] = []; // Stack to track nested objects

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Match Classes
            const classMatch = line.match(/^Class\s+(\w+)/);
            if (classMatch) {
                const className = classMatch[1];
                const classSymbol = new vscode.DocumentSymbol(
                    className,
                    'Class',
                    vscode.SymbolKind.Class,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );
                symbols.push(classSymbol);
                continue;
            }

            // Match Functions
            // Functions Take the Form of Function <functionName> <variables> returns <type> and 
            // They may also have the Byref keyword for parameters
            // Example: Function MyFunction String returns String
            // Example 2: Function MyFunction String Byref string returns String
            // End_Function closes the Function
            
            const functionMatch = line.match(/^Function\s+(\w+)/);            
            if (functionMatch) {
                const functionName = functionMatch[1];
                const functionSymbol = new vscode.DocumentSymbol(
                    functionName,
                    'Function',
                    vscode.SymbolKind.Function,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );

                if (objectStack.length > 0) {
                    // Add this function as a child of the current object on the stack
                    objectStack[objectStack.length - 1].children.push(functionSymbol);
                } else {
                    // Add this function to the top-level symbols
                    symbols.push(functionSymbol);
                }
                continue;
            }

            // Match Procedures
            const procedureMatch = line.match(/^Procedure\s+(\w+)/);
            if (procedureMatch) {
                const procedureName = procedureMatch[1];
                const procedureSymbol = new vscode.DocumentSymbol(
                    procedureName,
                    'Procedure',
                    vscode.SymbolKind.Method,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );

                if (objectStack.length > 0) {
                    // Add this procedure as a child of the current object on the stack
                    objectStack[objectStack.length - 1].children.push(procedureSymbol);
                } else {
                    // Add this procedure to the top-level symbols
                    symbols.push(procedureSymbol);
                }
                continue;
            }

            // Match Commands
            // Commands Take the Form of #COMMAND <commandName> and #END_COMMAND
            const commandMatch = line.match(/^#COMMAND\s+(\w+)/);
            if (commandMatch) {
                const commandName = commandMatch[1];
                const commandSymbol = new vscode.DocumentSymbol(
                    commandName,
                    'Command',
                    vscode.SymbolKind.Method,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );
                symbols.push(commandSymbol);
                continue;
            }
            // Match Labels
            // labels take the form of <labelName>: and are used for goto statements
            const labelRegex = "^\\s*\\b([a-zA-Z_][a-zA-Z0-9_]*)\\b:" // leading whitespace, label name, colon example: "label1:" or "  label1:"
            const labelMatch = line.match(labelRegex);
            if (labelMatch) {
                const labelName = labelMatch[1];
                const labelSymbol = new vscode.DocumentSymbol(
                    labelName,
                    'Label',
                    vscode.SymbolKind.String,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );
                symbols.push(labelSymbol);
                continue;
            }
            //Match Objects
            // Objects take the form of Object <objectName> is a[n] <className> and End_Object
            // Example: Object MyObject is a cMyClass
            // Example 2: Object MyObject is an cMyClass
            // End_Object closes the Object
            const objectMatch = line.match(/^Object\s+(\w+)\s+is\s+a[n]?\s+(\w+)/);            
            if (objectMatch) {
                const objectName = objectMatch[1];
                const className = objectMatch[2];
                const objectSymbol = new vscode.DocumentSymbol(
                    objectName,
                    `Object of type ${className}`,
                    vscode.SymbolKind.Object,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );

                if (objectStack.length > 0) {
                    // Add this object as a child of the current object on the stack
                    objectStack[objectStack.length - 1].children.push(objectSymbol);
                } else {
                    // Add this object to the top-level symbols
                    symbols.push(objectSymbol);
                }

                objectStack.push(objectSymbol); // Push the current object onto the stack
                continue;
            }

            // Match End_Object
            // End_Object closes the Object
            const endObjectMatch = line.match(/^End_Object/);
            if (endObjectMatch) {
                if (objectStack.length > 0) {
                    // Pop the current object from the stack
                    const completedObject = objectStack.pop();
                    if (completedObject) {
                        // Update the range to include the end of the object
                        completedObject.range = new vscode.Range(
                            completedObject.range.start,
                            new vscode.Position(i, line.length)
                        );
                    }
                }
                continue;
            }

            // Match Classes
            // Classes take the form of Class <className> is a <superClass> and End_Class
            // Example: Class MyClass is a cMySuperClass
            // End_Class closes the Class
            const classMatch2 = line.match(/^Class\s+(\w+)\s+is\s+a\s+(\w+)/);
            if (classMatch2) {
                const className = classMatch2[1];
                const superClass = classMatch2[2];
                const classSymbol = new vscode.DocumentSymbol(
                    className,
                    `Class of type ${superClass}`,
                    vscode.SymbolKind.Class,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );
                symbols.push(classSymbol);
                continue;
            }
            //Match Structs
            // Structs take the form of Struct <structName> and End_Struct
            // Example: Struct MyStruct
            // End_Struct closes the Struct
            const structMatch = line.match(/^Struct\s+(\w+)/);
            if (structMatch) {
                const structName = structMatch[1];
                const structSymbol = new vscode.DocumentSymbol(
                    structName,
                    'Struct',
                    vscode.SymbolKind.Struct,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length)),
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );
                symbols.push(structSymbol);
                continue;
            }

        }

        return symbols;
    }
}

async function findDefinition(word: string, document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | null> {
    // Await the result of findFiles
    const workspaceFiles = await vscode.workspace.findFiles(`**/*{${DATAFLEX_FILE_EXTENSIONS.join(',')}}`); // Await the Promise
    const exactMatchRegex = new RegExp(`\\b(${DATAFLEX_KEYWORDS.CONTROL.join('|')}\\s+${word}\\b`); // Match exact class or function name

    for (const file of workspaceFiles) {
        const fileContent = await vscode.workspace.openTextDocument(file); // Await the Promise
        const lines = fileContent.getText().split('\n');

        // Checks for global Symbols defined in exactMatchRegex
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (exactMatchRegex.test(line)) {
                return new vscode.Location(
                    fileContent.uri,
                    new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, line.length))
                );
            }

            //Now Check for variables and params in scope
            
            const functionScope = isWithinFunctionProcedureScope(position, lines, i);
            if (functionScope.inScope) {
                const variables = extractVariablesAndParameters(lines, functionScope.functionStartLine, functionScope.functionEndLine);
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

//Determines if a line is within a scope of a Function or Procedure
//Needs Testing
function isWithinFunctionProcedureScope(    
    position: vscode.Position,
    lines: string[],
    currentLine: number
): { inScope: boolean; functionStartLine : number; functionEndLine : number } {
    let inFunction : boolean = false;    
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
        const functionRange = new vscode.Range(
            new vscode.Position(functionStartLine, 0),
            new vscode.Position(functionEndLine, lines[functionEndLine].length)
        );        
        inFunction = functionRange.contains(position);        
    }
    return { inScope: inFunction, functionStartLine, functionEndLine }; 
}

//Need to Test
function extractVariablesAndParameters(lines: string[], functionStartLine: number, functionEndLine: number): 
    string[] {

    const variables: string[] = [];

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