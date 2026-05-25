import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SymbolIndexBuilder } from './SymbolIndexBuilder';

function makeDoc(content: string, uri = 'file:///test.src'): TextDocument {
    return TextDocument.create(uri, 'dataflex', 1, content);
}

describe('SymbolIndexBuilder', () => {

    describe('indexDocument – symbol extraction', () => {

        it('extracts a Procedure symbol', () => {
            const doc = makeDoc('Procedure MyProc\nEnd_Procedure');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.name, 'MyProc');
            assert.equal(sym.type, 'procedure');
        });

        it('extracts a Function symbol', () => {
            const doc = makeDoc('Function MyFunc Returns String\nEnd_Function');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.name, 'MyFunc');
            assert.equal(sym.type, 'function');
        });

        it('extracts a Class symbol', () => {
            const doc = makeDoc('Class MyClass is a Base\nEnd_Class');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.name, 'MyClass');
            assert.equal(sym.type, 'class');
        });

        it('extracts an Object symbol', () => {
            const doc = makeDoc('Object oMyObj is a cObject\nEnd_Object');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.name, 'oMyObj');
            assert.equal(sym.type, 'object');
        });

        it('extracts a #DEFINE symbol', () => {
            const doc = makeDoc('#DEFINE MY_CONST 42');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.name, 'MY_CONST');
            assert.equal(sym.type, 'define');
        });

        it('extracts multiple symbols from one document', () => {
            const doc = makeDoc([
                '#DEFINE MAX_SIZE 100',
                'Procedure DoSomething',
                'End_Procedure',
                'Function Calculate Returns Integer',
                'End_Function',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 3);
        });

        it('does not extract symbols from non-declaration lines', () => {
            const doc = makeDoc([
                '// this is a comment',
                'Send DoSomething',
                'Move 1 to iCount',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 0);
        });

    });

    describe('indexDocument – case insensitivity', () => {

        it('matches PROCEDURE in uppercase', () => {
            const doc = makeDoc('PROCEDURE MyProc\nEnd_Procedure');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym0] = symbols;
            assert.ok(sym0);
            assert.equal(sym0.type, 'procedure');
        });

        it('matches function in lowercase', () => {
            const doc = makeDoc('function MyFunc Returns String\nEnd_Function');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym0] = symbols;
            assert.ok(sym0);
            assert.equal(sym0.type, 'function');
        });

        it('matches #define in lowercase', () => {
            const doc = makeDoc('#define MY_CONST 42');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            assert.equal(symbols.length, 1);
            const [sym0] = symbols;
            assert.ok(sym0);
            assert.equal(sym0.type, 'define');
        });

    });

    describe('indexDocument – indented declarations', () => {

        it('matches an indented Procedure inside a Class', () => {
            const doc = makeDoc([
                'Class MyClass is a Base',
                '    Procedure MyProc',
                '    End_Procedure',
                'End_Class',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            const proc = symbols.find(s => s.type === 'procedure');
            assert.ok(proc, 'procedure symbol should be found');
            assert.equal(proc.name, 'MyProc');
        });

    });

    describe('indexDocument – location', () => {

        it('records the correct line number for a symbol', () => {
            const doc = makeDoc([
                '// line 0',
                'Procedure MyProc',  // line 1
                'End_Procedure',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.location.range.start.line, 1);
        });

        it('records the document URI on the location', () => {
            const uri = 'file:///myfile.src';
            const doc = makeDoc('Procedure MyProc\nEnd_Procedure', uri);
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.location.uri, uri);
        });

    });

    describe('indexDocument – scope attribution', () => {

        it('assigns global scope to a top-level Procedure', () => {
            const doc = makeDoc('Procedure MyProc\nEnd_Procedure');
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            const [sym] = symbols;
            assert.ok(sym);
            assert.equal(sym.scope.type, 'global');
        });

        it('assigns class scope to a Procedure defined inside a Class', () => {
            const doc = makeDoc([
                'Class MyClass is a Base',
                '    Procedure MyProc',
                '    End_Procedure',
                'End_Class',
            ].join('\n'));
            const { symbols } = SymbolIndexBuilder.indexDocument(doc);
            const proc = symbols.find(s => s.type === 'procedure');
            assert.ok(proc);
            assert.equal(proc.scope.type, 'class');
            assert.equal(proc.scope.name, 'MyClass');
        });

    });

});
