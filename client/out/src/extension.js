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
const vscode = __importStar(require("vscode"));
const compileConsoleMode_1 = require("./commands/compileConsoleMode");
const dataflexDocumentSymbolProvider_1 = require("./outline/dataflexDocumentSymbolProvider");
const dataflexDefinitionProvider_1 = require("./outline/dataflexDefinitionProvider");
const checkSrcEncoding_1 = require("./utils/checkSrcEncoding");
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
    //commands
    (0, compileConsoleMode_1.activate)(context);
}
function deactivate() {
    // Nothing to cleanup at the moment
}
module.exports = {
    activate,
    deactivate
};
