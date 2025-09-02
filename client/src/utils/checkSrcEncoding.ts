import * as vscode from 'vscode';

export function checkSrcEncoding(config: vscode.WorkspaceConfiguration) {
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