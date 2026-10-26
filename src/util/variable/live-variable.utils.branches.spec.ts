import { LiveVariableUtils } from './live-variable.utils';
import { DB_CONSTANTS } from '../../constants/variables.constants';

const modes = DB_CONSTANTS.DATABASE_MATCH_MODES;

describe('LiveVariableUtils - branches', () => {
    beforeEach(() => jest.restoreAllMocks());

    describe('getHibernateOrSqlType', () => {
        const variable: any = {
            propertiesMap: {
                columns: [
                    { fieldName: 'plain', type: 'string' },
                    { fieldName: 'ref', relatedColumnName: 'rc', type: 'integer' },
                    { relatedEntityName: 'Dept', columns: [{ fieldName: 'dname', type: 'string' }, { relatedColumnName: 'xcol', type: 'float' }] }
                ]
            }
        };

        it('finds columns by their related column name', () => {
            expect(LiveVariableUtils.getHibernateOrSqlType(variable, 'rc', 'type')).toBe('integer');
        });

        it('falls back to the columns of the related entity', () => {
            expect(LiveVariableUtils.getHibernateOrSqlType(variable, 'dname', 'type', 'Dept')).toBe('string');
            expect(LiveVariableUtils.getHibernateOrSqlType(variable, 'xcol', 'type', 'Dept')).toBe('float');
        });

        it('resolves nested fields and rejects deeper paths', () => {
            const nested: any = { propertiesMap: { columns: [{ fieldName: 'dept', columns: [{ fieldName: 'name', type: 'string' }] }] } };
            expect(LiveVariableUtils.getHibernateOrSqlType(nested, 'dept.name', 'type')).toBe('string');
            expect(LiveVariableUtils.getHibernateOrSqlType(nested, 'missing.name', 'type')).toBeUndefined();
            expect(LiveVariableUtils.getHibernateOrSqlType(nested, 'a.b.c', 'type')).toBeUndefined();
        });
    });

    describe('getFilterOption', () => {
        const variable: any = { propertiesMap: { columns: [] }, dateFormatter: { format: (v: any) => `d-${v}` } };
        const option = (fieldOptions: any, type: string | undefined, options: any = {}) => {
            jest.spyOn(LiveVariableUtils, 'getSQLFieldType').mockReturnValue(type as any);
            return LiveVariableUtils.getFilterOption(variable, { fieldName: 'f', ...fieldOptions }, options);
        };

        it('lists first-level values of complex objects, skipping nested and empty ones', () => {
            const result: any = option({ value: { a: 1, b: { c: 1 }, d: '', e: 'x' } }, 'string');
            expect(result).toEqual(['f.a=1', 'f.e=x']);
        });

        it('defaults the match mode of integer, date and other types to exact, keeping range modes', () => {
            expect((option({ value: '5' }, 'integer') as any).filterCondition).toBe(modes.exact);
            expect((option({ value: '5', filterCondition: modes.between }, 'integer') as any).filterCondition).toBe(modes.between);
            expect((option({ value: 'x' }, 'date') as any).filterCondition).toBe(modes.exact);
            expect((option({ value: 'x' }, 'timestamp', {}) as any).attributeType).toBe('TIMESTAMP');
            expect((option({ value: 'x' }, 'boolean') as any).filterCondition).toBe(modes.exact);
            expect((option({ value: 'x', filterCondition: modes.between }, 'boolean') as any).filterCondition).toBe(modes.between);
        });

        it('chooses string match modes for text and string types', () => {
            expect((option({ value: 'x' }, 'text') as any).filterCondition).toBe(modes.anywhereignorecase);
            expect((option({ value: ['a'], filterCondition: modes.in }, 'string') as any).filterCondition).toBe(modes.in);
            expect((option({ value: ['a'], filterCondition: modes.start }, 'string') as any).filterCondition).toBe(modes.exact);
            expect((option({ value: 'x', filterCondition: modes.start }, 'string') as any).filterCondition).toBe(modes.start);
        });

        it('chooses the match mode from the value when the type is unknown', () => {
            expect((option({ value: 'x' }, undefined) as any).filterCondition).toBe(modes.anywhereignorecase);
            expect((option({ value: 5 }, undefined) as any).filterCondition).toBe(modes.exact);
        });

        it('converts empty match modes for non-string types and flags variable filters of query requests', () => {
            const empty = DB_CONSTANTS.DATABASE_EMPTY_MATCH_MODES[0];
            const converted: any = option({ filterCondition: empty, isVariableFilter: true }, 'integer', { searchWithQuery: true });
            expect(converted.attributeValue).toBe('');
            expect(converted.isVariableFilter).toBe(true);
            const stringEmpty: any = option({ filterCondition: empty }, 'string');
            expect(stringEmpty.filterCondition).toBe(empty);
            expect(stringEmpty.isVariableFilter).toBeUndefined();
        });

        it('returns nothing for missing values and flags variable filters for value based options', () => {
            expect(option({ value: '' }, 'string')).toBeUndefined();
            expect(option({ value: null }, 'string')).toBeUndefined();
            const flagged: any = option({ value: 'x', isVariableFilter: true }, 'string', { searchWithQuery: true });
            expect(flagged.isVariableFilter).toBe(true);
        });
    });

    describe('getFilterOptions', () => {
        it('collects single options and flattens array results', () => {
            jest.spyOn(LiveVariableUtils, 'getFilterOption')
                .mockReturnValueOnce({ a: 1 } as any)
                .mockReturnValueOnce([{ b: 1 }, { c: 1 }] as any)
                .mockReturnValueOnce(undefined as any);
            expect(LiveVariableUtils.getFilterOptions({}, [1, 2, 3], {})).toEqual([{ a: 1 }, { b: 1 }, { c: 1 }]);
        });
    });

    describe('getParamValue', () => {
        const param = (condition: string, value: any, type = 'string', ignoreCase = false) =>
            LiveVariableUtils.getParamValue(value, { filterCondition: condition, attributeType: type }, ignoreCase, true);

        it.each([
            [modes.start, 'a', "'a%'"],
            [modes.startignorecase, 'a', "'a%'"],
            [modes.end, 'a', "'%a'"],
            [modes.endignorecase, 'a', "'%a'"],
            [modes.anywhere, 'a', "'%a%'"],
            [modes.nowhere, 'a', "'%a%'"],
            [modes.nowhereignorecase, 'a', "'%a%'"],
            [modes.anywhereignorecase, 'a', "'%a%'"],
            [modes.exact, 'a', "'a'"]
        ])('builds the parameter for %s', (condition, value, expected) => {
            expect(param(condition, value)).toBe(expected);
        });

        it('builds ranges and lists, lower-casing when ignoring case', () => {
            expect(param(modes.between, [1, 5], 'integer')).toBe('1 and 5');
            expect(param(modes.in, ['a', 'b'])).toBe("('a', 'b')");
            expect(param(modes.notin, ['a'], 'string', true)).toContain("('a')");
            expect(param(modes.startignorecase, 'A', 'string', true)).toBe("lower('A%')");
        });

        it('returns an empty string for empty match modes', () => {
            expect(param(DB_CONSTANTS.DATABASE_EMPTY_MATCH_MODES[0], 'x')).toBe('');
        });
    });

    describe('getSearchField / generateSearchQuery', () => {
        const field = (extra: any) => ({ attributeName: 'name', attributeType: 'STRING', filterCondition: modes.exact, attributeValue: 'x', ...extra });

        it('skips fields without usable values', () => {
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: [] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a', null] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a', NaN] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a', ''] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: NaN, attributeType: 'INTEGER' }), false, true)).toBeUndefined();
        });

        it('treats array values as in lists unless they are range modes', () => {
            const inQuery = LiveVariableUtils.getSearchField(field({ attributeValue: ['a', 'b'], filterCondition: modes.exact }), false, true);
            expect(inQuery).toContain("'a'");
            const range = LiveVariableUtils.getSearchField(field({ attributeValue: [1, 2], attributeType: 'INTEGER', filterCondition: modes.between }), false, true);
            expect(range).toContain('1 and 2');
        });

        it('builds nested queries, ignoring empty groups and unusable rules', () => {
            const rules: any = [
                null,
                { rules: [] },
                { rules: [field({ attributeValue: 'a' })], condition: 'OR' },
                field({ attributeValue: [] }),
                field({ attributeValue: 'b' })
            ];
            const query = LiveVariableUtils.generateSearchQuery(rules, 'AND', false, true);
            expect(query.split(' AND ')).toHaveLength(2);
            expect(query).toContain('(');
        });

        it('applies per-rule ignore case settings', () => {
            expect(LiveVariableUtils.getIgnoreCase(modes.start, true)).toBe(false);
            expect(LiveVariableUtils.getIgnoreCase(modes.startignorecase, false)).toBe(true);
            expect(LiveVariableUtils.getIgnoreCase('other', true)).toBe(true);
        });
    });

    describe('processFilterFields', () => {
        const variable: any = { matchMode: 'exact', propertiesMap: { columns: [] } };

        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'getSQLFieldType').mockReturnValue('string' as any);
            jest.spyOn(LiveVariableUtils, 'getFilterOption').mockImplementation(((_v: any, opts: any) => opts) as any);
        });

        it('removes bound rules and processes nested groups', () => {
            const rules: any = [
                { target: 'a', value: 'bind:x', matchMode: 'exact' },
                { target: 'b', matchMode: 'between', value: '1', secondvalue: 'bind:y' },
                { rules: [{ target: 'c', value: 'v', matchMode: 'exact' }] },
                null,
                { target: null, matchMode: 'exact' }
            ];
            LiveVariableUtils.processFilterFields(rules, variable, {});
            expect(rules.filter((r: any) => r && r.target === 'a')).toHaveLength(0);
            expect(rules.filter((r: any) => r && r.target === 'b')).toHaveLength(0);
            expect(rules.find((r: any) => r && r.rules).rules[0].fieldName).toBe('c');
        });

        it('splits list values and builds range values', () => {
            const rules: any = [
                { target: 'a', matchMode: 'in', value: 'x, y' },
                { target: 'b', matchMode: 'notin', value: ['p'] },
                { target: 'c', matchMode: 'in', value: '' },
                { target: 'd', matchMode: 'between', value: 1, secondvalue: 5 },
                { target: 'e', matchMode: 'between', value: [2, 3] },
                { target: 'f', matchMode: 'exact', value: 'z' }
            ];
            LiveVariableUtils.processFilterFields(rules, variable, { matchMode: 'start' });
            expect(rules[0].value).toEqual(['x', 'y']);
            expect(rules[1].value).toEqual(['p']);
            expect(rules[2].value).toBe('');
            expect(rules[3].value).toEqual([1, 5]);
            expect(rules[4].value).toEqual([2, 3]);
            expect(rules[5].value).toBe('z');
        });

        it('falls back to the options and variable match mode', () => {
            const rules: any = [{ target: 'a', matchMode: '', value: 'x' }];
            LiveVariableUtils.processFilterFields(rules, variable, { matchMode: 'start' });
            expect(rules[0].filterCondition).toBe('start');
            const second: any = [{ target: 'a', matchMode: '', value: 'x' }];
            LiveVariableUtils.processFilterFields(second, variable, {});
            expect(second[0].filterCondition).toBe('exact');
        });
    });
});
