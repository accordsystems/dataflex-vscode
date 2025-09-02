"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = require("vscode");
const child_process_1 = require("child_process");
function activate(context) {
    const command = 'dataflex.compileConsoleMode';
    const commandHandler = () => {
        console.log('Compile in Console Mode command executed');
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const fileName = editor.document.fileName;
        const config = vscode.workspace.getConfiguration('dataflex');
        const scriptPath = config.get('consoleMode.compileScriptPath');
        if (!scriptPath) {
            vscode.window.showErrorMessage('Compile script path is not configured');
            return;
        }
        (0, child_process_1.execFile)('pwsh.exe', ['-File', scriptPath, fileName], (error, stdout, stderr) => {
            if (error) {
                console.error('Error executing script:', error);
                vscode.window.showErrorMessage('Error executing script: ' + error.message);
                return;
            }
            console.log('Script output:', stdout);
            vscode.window.showInformationMessage('Script executed successfully');
        });
    };
    context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
}
//# sourceMappingURL=compileConsoleMode.js.map