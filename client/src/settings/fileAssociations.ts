import * as vscode from 'vscode';
const SETTING = 'dataflex.additionalFileExtensions';

/**
 * Normalize user-supplied extensions to the canonical ".ext" form.
 * Accepts "nui", ".nui" or "*.nui" and lower-cases the result.
 */
export function normalizeExtensions(extensions: string[]): string[] {
    return extensions
        .map(e => e.trim().replace(/^\*?\.?/, ''))
        .filter(Boolean)
        .map(e => '.' + e.toLowerCase());
}

/** Read and normalize the configured additional DataFlex extensions. */
export function getAdditionalExtensions(): string[] {
    const raw = vscode.workspace.getConfiguration().get<string[]>(SETTING, []);
    return normalizeExtensions(raw);
}

// Merge additional extensions with default ones.
export async function applyFileAssociations(): Promise<void> {
    const exts = getAdditionalExtensions();

    const config = vscode.workspace.getConfiguration();
    const current = config.get<{ [key: string]: string }>('files.associations') ?? {};
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
export function registerFileAssociationWatcher(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SETTING)) {
                void applyFileAssociations();
            }
        })
    );
}
