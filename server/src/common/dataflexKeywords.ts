// Updated structure to include first-word-only indicator
export interface KeywordConfig {
    correctCasing: string;
    firstWordOnly: boolean;
    //onlyWordOnLine: boolean;
}

// DataFlex keywords with configuration
export const DATAFLEX_KEYWORDS: { [key: string]: KeywordConfig } = {
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
    while: { correctCasing: 'While', firstWordOnly: true },
    loop: { correctCasing: 'Loop', firstWordOnly: true },
    for: { correctCasing: 'For', firstWordOnly: true },
    case: { correctCasing: 'Case', firstWordOnly: true },
    begin: { correctCasing: 'Begin', firstWordOnly: true },
    end: { correctCasing: 'End', firstWordOnly: true },
    break: { correctCasing: 'Break', firstWordOnly: true }
};

// Export only the values of DATAFLEX_KEYWORDS (correct casing)
export const CASED_KEYWORDS: string[] = Object.values(DATAFLEX_KEYWORDS).map(config => config.correctCasing);

//Function to get all regexes for keywords
export function getAllKeywordRegexes(): [string, RegExp][] {
    return Object.entries(DATAFLEX_KEYWORDS).map(([keyword, config]) => [
        config.correctCasing,  // Return the correctCasing instead of the key
        createCaseSensitiveKeywordRegex(config)
    ]);
}

/**
 * Updated function to handle first-word-only matching
 * @param keyword The keyword to create a regex pattern for 
 * @returns RegExp object with the flags specified in the config
 */
export function createCaseSensitiveKeywordRegex(keyword: KeywordConfig): RegExp {    
    //const keywordConfig = getKeywordConfig(keyword);
    return createSimpleCasingRegex(keyword.correctCasing, keyword.firstWordOnly);    
}

// Helper function to get keyword configuration
export function getKeywordConfig(keyword: string): KeywordConfig | undefined {
    return DATAFLEX_KEYWORDS[keyword.toLowerCase()];
}

//REGEX Helper Functions
export function createSimpleCasingRegex(correctWord: string, firstWordOnly: boolean = false): RegExp {
    const pattern = firstWordOnly 
        ? `^\\s*${correctWord}\\b`
        : `\\b${correctWord}\\b`;
    
    return new RegExp(pattern, 'gi'); // Case-insensitive + global
}
