"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const DataflexCodeActions_1 = require("./codeActions/DataflexCodeActions");
const DataFlexValidator_1 = require("./validation/DataFlexValidator");
const SymbolIndexBuilder_1 = require("./Symbols/SymbolIndexBuilder");
const DefinitionFinder_1 = require("./Definitions/DefinitionFinder");
//not yet implemented
//const symbolIndex = new SymbolIndexBuilder(); // updates symbol index, finds definitions
const definitionFinder = new DefinitionFinder_1.DefinitionFinder(); // finds definitions
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Redirect console to LSP connection so all console.log/warn/error calls appear in the client output
console.log = (msg) => connection.console.log(msg);
console.warn = (msg) => connection.console.warn(msg);
console.error = (msg) => connection.console.error(msg);
// Create a simple text document manager.
let documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
//not Implemented.
//let hasDiagnosticRelatedInformationCapability: boolean = false;
//let hasAutoCorrectCapability: boolean = false;
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    //hasDiagnosticRelatedInformationCapability = !!(
    //  capabilities.textDocument &&
    //  capabilities.textDocument.publishDiagnostics &&
    //  capabilities.textDocument.publishDiagnostics.relatedInformation
    //);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            },
            // the client that this server supports code actions
            codeActionProvider: true,
            definitionProvider: true // 2025-09-05 Event Handler: onDefinition 
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
//Not yet implemented
//const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
//let globalSettings: ExampleSettings = defaultSettings;
// Cache the settings of all open documents
let documentSettings = new Map();
// connection.onDidChangeConfiguration(change => {
//   if (hasConfigurationCapability) {
//     // Reset all cached document settings
//     documentSettings.clear();
//   } else {
//     globalSettings = <ExampleSettings>(
//       (change.settings.languageServerExample || defaultSettings)
//     );
//   }
//     // Revalidate all open text documents
//   documents.all().forEach(validateTextDocument);
// });
// Not yet implemented, but this is where we would handle file changes that are relevant to the workspace, such as .sws or config files, and trigger a workspace re-resolution and re-validation of all documents if needed
// function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
//   if (!hasConfigurationCapability) {
//     return Promise.resolve(globalSettings);
//   }
//   let result = documentSettings.get(resource);
//   if (!result) {
//     result = connection.workspace.getConfiguration({
//       scopeUri: resource,
//       section: 'dataflex.languageServer'
//     });
//     documentSettings.set(resource, result);
//   }
//   return result;
// }
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
connection.onCodeAction((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    // Use the range provided by the client (usually the selection)
    return DataflexCodeActions_1.DataFlexCodeActions.getCodeActions(document, params.range);
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
    validateTextDocument(change.document);
    SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(change.document); // Update symbol index on document change
});
async function validateTextDocument(textDocument) {
    // In this simple example we get the settings for every validate run.
    let diagnostics = [];
    DataFlexValidator_1.DataFlexValidator.validateDocument(textDocument).forEach(diagnostic => {
        diagnostics.push(diagnostic);
    });
    // Send the computed diagnostics to VS Code.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VS Code
    connection.console.log('We received a file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition) => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
        {
            label: 'TypeScript',
            kind: node_1.CompletionItemKind.Text,
            data: 1
        },
        {
            label: 'JavaScript',
            kind: node_1.CompletionItemKind.Text,
            data: 2
        }
    ];
});
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    if (item.data === 1) {
        item.detail = 'TypeScript details';
        item.documentation = 'TypeScript documentation';
    }
    else if (item.data === 2) {
        item.detail = 'JavaScript details';
        item.documentation = 'JavaScript documentation';
    }
    return item;
});
//Definition Handler for Go to Definition Support. Currently not implemented, First step is current document
connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const position = params.position;
    const word = getWordAtPosition(document, position);
    if (!word) {
        return [];
    }
    return definitionFinder.findDefinitions(word, position, params.textDocument.uri);
});
// Helper function to get the word range at a given position
// Helper function to get word at position
function getWordRangeAtPosition(document, position) {
    const line = document.getText().split(/\r?\n/)[position.line];
    //guard
    if (!line)
        return { start: position, end: position };
    const wordRegex = /\b\w+\b/g;
    let match;
    while ((match = wordRegex.exec(line)) !== null) {
        if (match.index <= position.character &&
            position.character <= match.index + match[0].length) {
            return {
                start: { line: position.line, character: match.index },
                end: { line: position.line, character: match.index + match[0].length }
            };
        }
    }
    return { start: position, end: position };
}
function getWordAtPosition(document, position) {
    const wordRange = getWordRangeAtPosition(document, position);
    return document.getText(wordRange) || null;
}
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map