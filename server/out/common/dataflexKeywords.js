"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASED_KEYWORDS = exports.DATAFLEX_KEYWORDS = void 0;
exports.getAllKeywordRegexes = getAllKeywordRegexes;
exports.createCaseSensitiveKeywordRegex = createCaseSensitiveKeywordRegex;
exports.getKeywordConfig = getKeywordConfig;
exports.createSimpleCasingRegex = createSimpleCasingRegex;
// DataFlex keywords with configuration
exports.DATAFLEX_KEYWORDS = {
    //functions and procedures
    procedure: { correctCasing: 'Procedure', firstWordOnly: true },
    function: { correctCasing: 'Function', firstWordOnly: true },
    end_procedure: { correctCasing: 'End_Procedure', firstWordOnly: true },
    end_function: { correctCasing: 'End_Function', firstWordOnly: true },
    function_return: { correctCasing: 'Function_Return', firstWordOnly: true },
    procedure_return: { correctCasing: 'Procedure_Return', firstWordOnly: true },
    //Compiler Directives
    include: { correctCasing: '#INCLUDE', firstWordOnly: true },
    use: { correctCasing: 'Use', firstWordOnly: true },
    command: { correctCasing: '#COMMAND', firstWordOnly: true },
    end_command: { correctCasing: '#END_COMMAND', firstWordOnly: true },
    ifdef: { correctCasing: '#IFDEF', firstWordOnly: true },
    endifdef: { correctCasing: '#ENDIF', firstWordOnly: true },
    elseifdef: { correctCasing: '#ELSEIF', firstWordOnly: true },
    ifndef: { correctCasing: '#IFNDEF', firstWordOnly: true }, //VDF Only
    // classes and objects
    class: { correctCasing: 'Class', firstWordOnly: true },
    end_class: { correctCasing: 'End_Class', firstWordOnly: true },
    object: { correctCasing: 'Object', firstWordOnly: true },
    end_object: { correctCasing: 'End_Object', firstWordOnly: true },
    //Properties
    property: { correctCasing: 'Property', firstWordOnly: true },
    set: { correctCasing: 'Set', firstWordOnly: true },
    get: { correctCasing: 'Get', firstWordOnly: true },
    //Conditionals and Loops
    if: { correctCasing: 'If', firstWordOnly: true },
    else: { correctCasing: 'Else', firstWordOnly: true },
    elseif: { correctCasing: 'Else If', firstWordOnly: true },
    while: { correctCasing: 'While', firstWordOnly: true },
    loop: { correctCasing: 'Loop', firstWordOnly: true },
    for: { correctCasing: 'For', firstWordOnly: true },
    case: { correctCasing: 'Case', firstWordOnly: true },
    begin: { correctCasing: 'Begin', firstWordOnly: true },
    end: { correctCasing: 'End', firstWordOnly: true },
    break: { correctCasing: 'Break', firstWordOnly: true }
};
// Export only the values of DATAFLEX_KEYWORDS (correct casing)
exports.CASED_KEYWORDS = Object.values(exports.DATAFLEX_KEYWORDS).map(config => config.correctCasing);
//Function to get all regexes for keywords
function getAllKeywordRegexes() {
    return Object.entries(exports.DATAFLEX_KEYWORDS).map(([_keyword, config]) => [
        config.correctCasing, // Return the correctCasing instead of the key
        createCaseSensitiveKeywordRegex(config)
    ]);
}
/**
 * Updated function to handle first-word-only matching
 * @param keyword The keyword to create a regex pattern for
 * @returns RegExp object with the flags specified in the config
 */
function createCaseSensitiveKeywordRegex(keyword) {
    //const keywordConfig = getKeywordConfig(keyword);
    return createSimpleCasingRegex(keyword.correctCasing, keyword.firstWordOnly);
}
// Helper function to get keyword configuration
function getKeywordConfig(keyword) {
    return exports.DATAFLEX_KEYWORDS[keyword.toLowerCase()];
}
//REGEX Helper Functions
function createSimpleCasingRegex(correctWord, firstWordOnly = false) {
    const pattern = firstWordOnly
        ? `^\\s*${correctWord}\\b`
        : `\\b${correctWord}\\b`;
    return new RegExp(pattern, 'gi'); // Case-insensitive + global
}
//# sourceMappingURL=dataflexKeywords.js.map