"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeExtensions = normalizeExtensions;
exports.getAdditionalExtensions = getAdditionalExtensions;
exports.applyFileAssociations = applyFileAssociations;
exports.registerFileAssociationWatcher = registerFileAssociationWatcher;
const vscode = require("vscode");
const SETTING = 'dataflex.additionalFileExtensions';
/**
 * Normalize user-supplied extensions to the canonical ".ext" form.
 * Accepts "nui", ".nui" or "*.nui" and lower-cases the result.
 */
function normalizeExtensions(extensions) {
    return extensions
        .map(e => e.trim().replace(/^\*?\.?/, ''))
        .filter(Boolean)
        .map(e => '.' + e.toLowerCase());
}
/** Read and normalize the configured additional DataFlex extensions. */
function getAdditionalExtensions() {
    const raw = vscode.workspace.getConfiguration().get(SETTING, []);
    return normalizeExtensions(raw);
}
// Merge additional extensions with default ones.
async function applyFileAssociations() {
    const exts = getAdditionalExtensions();
    const config = vscode.workspace.getConfiguration();
    const current = config.get('files.associations') ?? {};
    const next = { ...current };
    for (const ext of exts) {
        next[`*${ext}`] = 'dataflex';
    }
    await config.update('files.associations', next, vscode.ConfigurationTarget.Workspace);
    // Re-tag already-open documents whose language wasn't resolved to dataflex.
    for (const doc of vscode.workspace.textDocuments) {
        if (doc.languageId !== 'dataflex' &&
            exts.some(ext => doc.fileName.toLowerCase().endsWith(ext))) {
            await vscode.languages.setTextDocumentLanguage(doc, 'dataflex');
        }
    }
}
/** Re-apply associations whenever the setting changes. */
function registerFileAssociationWatcher(context) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(SETTING)) {
            void applyFileAssociations();
        }
    }));
}
//# sourceMappingURL=fileAssociations.js.map