import * as vscode from 'vscode';
import { activate as activateCommandCompileConsoleMode } from './commands/compileConsoleMode';
import { DataFlexDocumentSymbolProvider } from './outline/dataflexDocumentSymbolProvider';
import { DataFlexDefinitionProvider } from './outline/dataflexDefinitionProvider';
import { checkSrcEncoding } from './utils/checkSrcEncoding';

function activate(context: vscode.ExtensionContext) {
    console.log('Dataflex Extension activated'); 
    
    //Definition Provider
    const definitionProvider = vscode.languages.registerDefinitionProvider('dataflex', new DataFlexDefinitionProvider());
    context.subscriptions.push(definitionProvider);
    //Symbols
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider('dataflex', new DataFlexDocumentSymbolProvider());
    context.subscriptions.push(symbolProvider);

    //Check Encoding: Show warning if not cp437
    const config = vscode.workspace.getConfiguration();
    // Check if the encoding for `.src` files is already set
    checkSrcEncoding(config);

    //commands
    activateCommandCompileConsoleMode(context);    
}

function deactivate() {
    // Nothing to cleanup at the moment
}

module.exports = {
    activate,
    deactivate
};