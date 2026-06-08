import {
  createConnection,
  TextDocuments,
  Diagnostic,
  //DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  CodeAction,
  //CodeActionKind,
  CodeActionParams,
  //TextEdit,
  DefinitionParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DataFlexCodeActions } from './codeActions/DataflexCodeActions';
import { DataFlexValidator } from './validation/DataFlexValidator';
import { Location, Position, Range } from 'vscode-languageserver/node'; // Added for Definition Support
import { SymbolIndexBuilder } from './Symbols/SymbolIndexBuilder';
import { DefinitionFinder } from './Definitions/DefinitionFinder';
import { DataflexWorkspaceResolver, ResolvedWorkspace } from './workspace/DataflexWorkspaceResolver';

//not yet implemented
//const symbolIndex = new SymbolIndexBuilder(); // updates symbol index, finds definitions
const definitionFinder = new DefinitionFinder(); // finds definitions

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Redirect console to LSP connection so all console.log/warn/error calls appear in the client output
console.log = (msg: string) => connection.console.log(msg);
console.warn = (msg: string) => connection.console.warn(msg);
console.error = (msg: string) => connection.console.error(msg);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

//not Implemented.
//let hasDiagnosticRelatedInformationCapability: boolean = false;
//let hasAutoCorrectCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  //hasDiagnosticRelatedInformationCapability = !!(
  //  capabilities.textDocument &&
  //  capabilities.textDocument.publishDiagnostics &&
  //  capabilities.textDocument.publishDiagnostics.relatedInformation
  //);

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
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

let resolvedWorkspace: ResolvedWorkspace | null = null;

connection.onInitialized(async () => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
    await resolveWorkspace();
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
  

});

async function resolveWorkspace(): Promise<void> {
  const swsFile = await connection.workspace.getConfiguration('dataflex.workspace.swsFile')
  if (!swsFile) return;
  try {
    resolvedWorkspace = DataflexWorkspaceResolver.resolve(swsFile);        
    connection.console.log(`[WorkspaceResolver] Resolved: ${resolvedWorkspace.swsPath}`);
  }
  catch (e) {
    connection.console.warn(`[WorkspaceResolver] ${(e as Error).message}`)
  }
}

// The example settings
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.

//Not yet implemented
//const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
//let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(async () => {
    if (!hasConfigurationCapability) return;
    await resolveWorkspace();
});

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

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }
  // Use the range provided by the client (usually the selection)
  return DataFlexCodeActions.getCodeActions(document, params.range);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async change => {
  validateTextDocument(change.document);
  SymbolIndexBuilder.indexDocument(change.document); // Update symbol index on document change
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // In this simple example we get the settings for every validate run.
  let diagnostics: Diagnostic[] = [];
  DataFlexValidator.validateDocument(textDocument).forEach(diagnostic => {
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
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
      {
        label: 'TypeScript',
        kind: CompletionItemKind.Text,
        data: 1
      },
      {
        label: 'JavaScript',
        kind: CompletionItemKind.Text,
        data: 2
      }
    ];
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
      item.detail = 'TypeScript details';
      item.documentation = 'TypeScript documentation';
    } else if (item.data === 2) {
      item.detail = 'JavaScript details';
      item.documentation = 'JavaScript documentation';
    }
    return item;
  }
);

//Definition Handler for Go to Definition Support. Currently not implemented, First step is current document
connection.onDefinition(
  (params: DefinitionParams): Location[] => {
    const document = documents.get(params.textDocument.uri)
    if (!document) {
      return [];
    }

    const position: Position = params.position
    const word = getWordAtPosition(document, position)
    if (!word) {
      return [];
    }
    return definitionFinder.findDefinitions(word, position, params.textDocument.uri);
  }
);

// Helper function to get the word range at a given position
// Helper function to get word at position
function getWordRangeAtPosition(document: TextDocument, position: Position): Range {
  const line = document.getText().split(/\r?\n/)[position.line];  
  //guard
  if (!line) return { start: position, end: position };

  const wordRegex = /\b\w+\b/g;
  let match: RegExpExecArray | null;

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

function getWordAtPosition(document: TextDocument, position: Position): string | null {
  const wordRange = getWordRangeAtPosition(document, position);
  return document.getText(wordRange) || null;
}


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
