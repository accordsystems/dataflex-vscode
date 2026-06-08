"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const dataflexLanguageClient_1 = require("./languageClient/dataflexLanguageClient");
const compileConsoleMode_1 = require("./commands/compileConsoleMode");
const dataflexDocumentSymbolProvider_1 = require("./outline/dataflexDocumentSymbolProvider");
const dataflexDefinitionProvider_1 = require("./outline/dataflexDefinitionProvider");
const checkSrcEncoding_1 = require("./utils/checkSrcEncoding");
;
const fileAssociations_1 = require("./settings/fileAssociations");
let client;
function activate(context) {
    console.log('Dataflex Extension activated');
    //Definition Provider
    const definitionProvider = vscode.languages.registerDefinitionProvider('dataflex', new dataflexDefinitionProvider_1.DataFlexDefinitionProvider());
    context.subscriptions.push(definitionProvider);
    //Symbols
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider('dataflex', new dataflexDocumentSymbolProvider_1.DataFlexDocumentSymbolProvider());
    context.subscriptions.push(symbolProvider);
    //Check Encoding: Show warning if not cp437
    const config = vscode.workspace.getConfiguration();
    // Check if the encoding for `.src` files is already set
    (0, checkSrcEncoding_1.checkSrcEncoding)(config);
    //Apply user-configured custom file extensions and watch for changes
    void (0, fileAssociations_1.applyFileAssociations)();
    (0, fileAssociations_1.registerFileAssociationWatcher)(context);
    //commands
    (0, compileConsoleMode_1.activate)(context);
    client = (0, dataflexLanguageClient_1.activate)(context);
}
function deactivate() {
    if (client) {
        return client.stop();
    }
    else
        return undefined;
}
//# sourceMappingURL=extension.js.map