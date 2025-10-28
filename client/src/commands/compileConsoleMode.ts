import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext){
    const command = 'dataflex.compileConsoleMode';
    const commandHandler = () => {
        console.log('Compile in Console Mode command executed');
        const editor = vscode.window.activeTextEditor;
        if (!editor){
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const fileName = editor.document.fileName;

        const config = vscode.workspace.getConfiguration('dataflex');
        const scriptPath = config.get('consoleMode.compileScriptPath') as string;

        if (!scriptPath) {
            vscode.window.showErrorMessage('Compile script path is not configured');
            return;
        }

        // Create or reuse terminal for compilation
        const terminalName = 'DataFlex Compile';
        let terminal = vscode.window.terminals.find(t => t.name === terminalName);

        if (!terminal) {
            terminal = vscode.window.createTerminal(terminalName);
        }

        // Show the terminal and execute the command
        terminal.show();
        terminal.sendText(`pwsh.exe -File "${scriptPath}" "${fileName}"`);
    }
    context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
}