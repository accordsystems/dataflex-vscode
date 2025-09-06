//Dataflex Variable Types
export const DATAFLEX_VARIABLES = {
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    integer : 'Integer',
    handle : 'Handle',
    date: 'Date',
    dateTime : 'DateTime',
    rowid : 'RowID',
} as const;

export type DataFlexVariableType = typeof DATAFLEX_VARIABLES[keyof typeof DATAFLEX_VARIABLES];
