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
}

class DataFlexDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        
        const symbols: vscode.DocumentSymbol[] = [];
        const lines = document.getText().split('\n');

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
                symbols.push(functionSymbol);
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
                symbols.push(procedureSymbol);
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