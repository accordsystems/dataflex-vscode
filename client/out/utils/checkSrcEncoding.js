"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSrcEncoding = checkSrcEncoding;
const vscode = require("vscode");
function checkSrcEncoding(config) {
    const encoding = config.get('files.encoding');
    const associations = config.get('files.associations');
    if (encoding !== 'cp437' || !associations || associations['*.src'] !== 'dataflex') {
        vscode.window.showInformationMessage('It is recommended to set the encoding for `.src` files to cp437 and associate them with the Dataflex language. Add the following to your settings.json:\n\n' +
            `"files.encoding": "cp437",\n` +
            `"files.associations": {\n` +
            `  "*.src": "dataflex"\n` +
            `}`);
    }
}
//# sourceMappingURL=checkSrcEncoding.js.map