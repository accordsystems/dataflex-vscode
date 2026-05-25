"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const assert_1 = require("assert");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const SymbolIndexBuilder_1 = require("./SymbolIndexBuilder");
function makeDoc(content, uri = 'file:///test.src') {
    return vscode_languageserver_textdocument_1.TextDocument.create(uri, 'dataflex', 1, content);
}
(0, mocha_1.describe)('SymbolIndexBuilder', () => {
    (0, mocha_1.describe)('indexDocument – symbol extraction', () => {
        (0, mocha_1.it)('extracts a Procedure symbol', () => {
            const doc = makeDoc('Procedure MyProc\nEnd_Procedure');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.name, 'MyProc');
            assert_1.strict.equal(sym.type, 'procedure');
        });
        (0, mocha_1.it)('extracts a Function symbol', () => {
            const doc = makeDoc('Function MyFunc Returns String\nEnd_Function');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.name, 'MyFunc');
            assert_1.strict.equal(sym.type, 'function');
        });
        (0, mocha_1.it)('extracts a Class symbol', () => {
            const doc = makeDoc('Class MyClass is a Base\nEnd_Class');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.name, 'MyClass');
            assert_1.strict.equal(sym.type, 'class');
        });
        (0, mocha_1.it)('extracts an Object symbol', () => {
            const doc = makeDoc('Object oMyObj is a cObject\nEnd_Object');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.name, 'oMyObj');
            assert_1.strict.equal(sym.type, 'object');
        });
        (0, mocha_1.it)('extracts a #DEFINE symbol', () => {
            const doc = makeDoc('#DEFINE MY_CONST 42');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.name, 'MY_CONST');
            assert_1.strict.equal(sym.type, 'define');
        });
        (0, mocha_1.it)('extracts multiple symbols from one document', () => {
            const doc = makeDoc([
                '#DEFINE MAX_SIZE 100',
                'Procedure DoSomething',
                'End_Procedure',
                'Function Calculate Returns Integer',
                'End_Function',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 3);
        });
        (0, mocha_1.it)('does not extract symbols from non-declaration lines', () => {
            const doc = makeDoc([
                '// this is a comment',
                'Send DoSomething',
                'Move 1 to iCount',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 0);
        });
    });
    (0, mocha_1.describe)('indexDocument – case insensitivity', () => {
        (0, mocha_1.it)('matches PROCEDURE in uppercase', () => {
            const doc = makeDoc('PROCEDURE MyProc\nEnd_Procedure');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym0] = symbols;
            assert_1.strict.ok(sym0);
            assert_1.strict.equal(sym0.type, 'procedure');
        });
        (0, mocha_1.it)('matches function in lowercase', () => {
            const doc = makeDoc('function MyFunc Returns String\nEnd_Function');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym0] = symbols;
            assert_1.strict.ok(sym0);
            assert_1.strict.equal(sym0.type, 'function');
        });
        (0, mocha_1.it)('matches #define in lowercase', () => {
            const doc = makeDoc('#define MY_CONST 42');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            assert_1.strict.equal(symbols.length, 1);
            const [sym0] = symbols;
            assert_1.strict.ok(sym0);
            assert_1.strict.equal(sym0.type, 'define');
        });
    });
    (0, mocha_1.describe)('indexDocument – indented declarations', () => {
        (0, mocha_1.it)('matches an indented Procedure inside a Class', () => {
            const doc = makeDoc([
                'Class MyClass is a Base',
                '    Procedure MyProc',
                '    End_Procedure',
                'End_Class',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            const proc = symbols.find(s => s.type === 'procedure');
            assert_1.strict.ok(proc, 'procedure symbol should be found');
            assert_1.strict.equal(proc.name, 'MyProc');
        });
    });
    (0, mocha_1.describe)('indexDocument – location', () => {
        (0, mocha_1.it)('records the correct line number for a symbol', () => {
            const doc = makeDoc([
                '// line 0',
                'Procedure MyProc', // line 1
                'End_Procedure',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.location.range.start.line, 1);
        });
        (0, mocha_1.it)('records the document URI on the location', () => {
            const uri = 'file:///myfile.src';
            const doc = makeDoc('Procedure MyProc\nEnd_Procedure', uri);
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.location.uri, uri);
        });
    });
    (0, mocha_1.describe)('indexDocument – scope attribution', () => {
        (0, mocha_1.it)('assigns global scope to a top-level Procedure', () => {
            const doc = makeDoc('Procedure MyProc\nEnd_Procedure');
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            const [sym] = symbols;
            assert_1.strict.ok(sym);
            assert_1.strict.equal(sym.scope.type, 'global');
        });
        (0, mocha_1.it)('assigns class scope to a Procedure defined inside a Class', () => {
            const doc = makeDoc([
                'Class MyClass is a Base',
                '    Procedure MyProc',
                '    End_Procedure',
                'End_Class',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder_1.SymbolIndexBuilder.indexDocument(doc);
            const proc = symbols.find(s => s.type === 'procedure');
            assert_1.strict.ok(proc);
            assert_1.strict.equal(proc.scope.type, 'class');
            assert_1.strict.equal(proc.scope.name, 'MyClass');
        });
    });
});
//# sourceMappingURL=SymbolIndexBuilder.test.js.map