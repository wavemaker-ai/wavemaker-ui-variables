import { LiveVariableUtils } from './live-variable.utils';
import { $rootScope } from '../../constants/variables.constants';

describe('LiveVariableUtils - additional paths', () => {
    const variable = (overrides: any = {}): any => ({
        operation: 'read',
        dateFormatter: { format: (epoch: any) => `fmt-${epoch}` },
        propertiesMap: {
            columns: [
                { fieldName: 'age', type: 'integer' },
                { fieldName: 'name', type: 'string' },
                { fieldName: 'born', type: 'date' },
                { fieldName: 'score', type: 'float' },
            ],
        },
        ...overrides,
    });

    describe('getFilterOption', () => {
        it('keeps only the valid numbers of integer lists', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'age', value: ['1', 'x', '3'] }, {});
            expect(result.attributeValue).toEqual([1, 3]);
        });

        it('keeps range match modes for integer fields and falls back to equals otherwise', () => {
            const between: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'age', value: ['1', '5'], matchMode: 'between' }, {});
            expect(between.filterCondition).toBe('BETWEEN');
            const other: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'age', value: '4', matchMode: 'start' }, {});
            expect(other.filterCondition).toBe('EQUALS');
        });

        it('formats date values with the date formatter', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'born', value: 1700000000000 }, {});
            expect(result.attributeValue).toContain('1700000000000');
            expect(result.filterCondition).toBe('EQUALS');
        });

        it('uses exact or the given condition for lists of strings', () => {
            const exact: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'name', value: ['a', 'b'] }, {});
            expect(exact.filterCondition).toBe('EQUALS');
            const inMode: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'name', value: ['a', 'b'], matchMode: 'in' }, {});
            expect(inMode.filterCondition).toBe('IN');
        });

        it('keeps the given condition for single strings', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'name', value: 'x', matchMode: 'start' }, {});
            expect(result.filterCondition).toBe('STARTING_WITH');
        });

        it('uses the match mode for other types and exact by default', () => {
            const range: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'score', value: 2.5, matchMode: 'between' }, {});
            expect(range.filterCondition).toBe('BETWEEN');
            const plain: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'score', value: 2.5 }, {});
            expect(plain.filterCondition).toBe('EQUALS');
        });

        it('guesses the condition when the field type is unknown', () => {
            const text: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'other', value: 'x' }, {});
            expect(text.filterCondition).toBe('CONTAINING_IGNORECASE');
            const number: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'other', value: 5 }, {});
            expect(number.filterCondition).toBe('EQUALS');
        });

        it('marks the options of queries as variable filters', () => {
            const filled: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'age', value: '5', isVariableFilter: true }, { searchWithQuery: true });
            expect(filled.isVariableFilter).toBe(true);
            const empty: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'age', matchMode: 'null', value: '', isVariableFilter: true }, { searchWithQuery: true });
            expect(empty.isVariableFilter).toBe(true);
        });

        it('keeps the empty match mode for string fields', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable(), { fieldName: 'name', matchMode: 'empty', value: '' }, {});
            expect(result.filterCondition).toBe('EMPTY');
        });

        it('concatenates the entries of complex values in lists of options', () => {
            const result = LiveVariableUtils.getFilterOptions(variable(), [
                { fieldName: 'address', value: { city: 'X' } },
                { fieldName: 'age', value: '5' },
            ], {});
            expect(result).toHaveLength(2);
            expect(result[0]).toBe('address.city=X');
        });
    });

    describe('getParamValue', () => {
        const option = (filterCondition: string, extra: any = {}) => ({ filterCondition, attributeType: 'string', ...extra });

        it.each([
            ['STARTING_WITH', 'ab', "'ab%'"],
            ['STARTING_WITH_IGNORECASE', 'ab', "lower('ab%')"],
            ['ENDING_WITH', 'ab', "'%ab'"],
            ['ENDING_WITH_IGNORECASE', 'ab', "lower('%ab')"],
            ['CONTAINING', 'ab', "'%ab%'"],
            ['CONTAINING_IGNORECASE', 'ab', "lower('%ab%')"],
            ['DOES_NOT_CONTAIN', 'ab', "'%ab%'"],
            ['EQUALS', 'ab', "'ab'"],
        ])('builds the parameter for %s', (mode, value, expected) => {
            expect(LiveVariableUtils.getParamValue(value, option(mode), expected.startsWith('lower'), true)).toBe(expected);
        });

        it('joins between values with and', () => {
            expect(LiveVariableUtils.getParamValue([1, 5], option('BETWEEN', { attributeType: 'integer' }), false, true)).toBe('1 and 5');
        });

        it('lists in values in parentheses', () => {
            expect(LiveVariableUtils.getParamValue(['a', 'b'], option('IN'), false, true)).toBe("('a', 'b')");
            expect(LiveVariableUtils.getParamValue(['a'], option('NOTIN'), false, true)).toBe("('a')");
        });

        it('needs no value for empty match modes', () => {
            expect(LiveVariableUtils.getParamValue('', option('NULL'), false, true)).toBe('');
        });
    });

    describe('getSearchQuery', () => {
        const filterOption = (overrides: any) => ({ attributeName: 'name', attributeValue: 'x', attributeType: 'STRING', filterCondition: 'EQUALS', ...overrides });

        it('joins the clauses of all options with the operator', () => {
            const query = LiveVariableUtils.getSearchQuery([filterOption({}), filterOption({ attributeName: 'city', attributeValue: 'y' })], ' OR ', false, true);
            expect(query).toBe("name='x' OR city='y'");
        });

        it('skips empty lists, NaN numbers and invalid dates', () => {
            const query = LiveVariableUtils.getSearchQuery([
                filterOption({ attributeValue: [] }),
                filterOption({ attributeValue: NaN, attributeType: 'INTEGER' }),
                filterOption({ attributeValue: NaN, attributeType: 'DATE' }),
                filterOption({ attributeName: 'ok', attributeValue: 1, attributeType: 'INTEGER' }),
            ], ' AND ', false, true);
            expect(query).toBe('ok=1');
        });

        it('turns lists into in queries unless between or notin was chosen', () => {
            const list = filterOption({ attributeValue: ['a', 'b'] });
            expect(LiveVariableUtils.getSearchQuery([list], ' AND ', false, true)).toBe("name in ('a', 'b')");
            expect(list.filterCondition).toBe('IN');
            const between = filterOption({ attributeValue: [1, 2], attributeType: 'INTEGER', filterCondition: 'BETWEEN' });
            expect(LiveVariableUtils.getSearchQuery([between], ' AND ', false, true)).toContain('between');
        });
    });

    describe('getSearchField', () => {
        const field = (overrides: any) => ({ attributeName: 'name', attributeValue: 'x', attributeType: 'STRING', filterCondition: 'EQUALS', ...overrides });

        it('builds the clause of a single field', () => {
            expect(LiveVariableUtils.getSearchField(field({}), false, true)).toBe("name='x'");
        });

        it('returns nothing for values that cannot be queried', () => {
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: [] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a', null] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a', ''] }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: NaN, attributeType: 'INTEGER' }), false, true)).toBeUndefined();
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: NaN, attributeType: 'DATE' }), false, true)).toBeUndefined();
        });

        it('converts lists to in clauses', () => {
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a', 'b'] }), false, true)).toBe("name in ('a', 'b')");
            expect(LiveVariableUtils.getSearchField(field({ attributeValue: ['a'], filterCondition: 'NOTIN' }), false, true)).toBe("name not in ('a')");
        });
    });

    describe('processFilterFields', () => {
        it('removes rules bound to expressions and splits in and between values', () => {
            const rules: any[] = [
                { target: 'age', type: 'integer', matchMode: 'in', value: '1, 2' },
                { target: 'age', type: 'integer', matchMode: 'between', value: '1', secondvalue: '5' },
                { target: 'age', type: 'integer', matchMode: 'between', value: ['2', '4'] },
                { target: 'name', type: 'string', matchMode: 'exact', value: 'bind:Widgets.x.datavalue' },
                { target: 'age', type: 'integer', matchMode: 'exact', value: 'bind:Widgets.y', secondvalue: undefined },
                { rules: [{ target: 'age', type: 'integer', matchMode: 'exact', value: '9' }] },
                null,
                { target: null, matchMode: 'exact' },
            ];
            LiveVariableUtils.processFilterFields(rules, variable(), {});
            expect(rules[0].attributeValue).toEqual([1, 2]);
            expect(rules[1].attributeValue).toEqual([1, 5]);
            expect(rules[2].attributeValue).toEqual([2, 4]);
            expect(rules[3].rules[0].attributeValue).toBe(9);
        });

        it('also drops between rules whose second value is bound', () => {
            const rules: any[] = [{ target: 'age', type: 'integer', matchMode: 'between', value: '1', secondvalue: 'bind:x' }];
            LiveVariableUtils.processFilterFields(rules, variable(), {});
            expect(rules).toEqual([]);
        });

        it('falls back to the variable match mode when a rule has none', () => {
            const rules: any[] = [{ target: 'name', type: 'string', matchMode: 'exact', value: 'x' }];
            LiveVariableUtils.processFilterFields(rules, variable({ matchMode: 'start' }), {});
            expect(rules[0].filterCondition).toBe('EQUALS');
        });
    });

    describe('processBlobColumns', () => {
        const blobVariable = (overrides: any = {}) => variable({
            liveSource: 'db',
            type: 'User',
            propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }], primaryFields: ['id'] },
            ...overrides,
        });

        beforeEach(() => {
            ($rootScope as any).project = { deployedUrl: 'http://host/' };
        });

        it('replaces empty blob fields with the content url', () => {
            const data: any = [{ id: 1, photo: '' }, { id: 2, photo: null }, { id: 3, photo: 'x' }, null];
            LiveVariableUtils.processBlobColumns(data, blobVariable());
            expect(data[0].photo).toBe('services/db/User/1/content/photo');
            expect(data[1].photo).toBeNull();
            expect(data[2].photo).toBe('x');
        });

        it('uses the prefab path for prefab variables', () => {
            const data: any = [{ id: 1, photo: '' }];
            LiveVariableUtils.processBlobColumns(data, blobVariable({ _prefabName: 'lib' }));
            expect(data[0].photo).toBe('prefabs/lib/db/User/1/content/photo');
        });

        it('builds composite urls for composite keys', () => {
            const data: any = [{ a: 1, b: 2, photo: '' }];
            LiveVariableUtils.processBlobColumns(data, blobVariable({ propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }], primaryFields: ['a', 'b'] } }));
            expect(data[0].photo).toContain('composite-id/content/photo?');
            expect(data[0].photo).toContain('a=1');
        });

        it('does nothing without data or blob columns', () => {
            expect(() => LiveVariableUtils.processBlobColumns(undefined, blobVariable())).not.toThrow();
            const data: any = [{ id: 1, photo: '' }];
            LiveVariableUtils.processBlobColumns(data, blobVariable({ propertiesMap: { columns: [{ fieldName: 'photo', type: 'string' }] } }));
            expect(data[0].photo).toBe('');
        });
    });

    describe('prepareFormData', () => {
        it('appends blob values and clears them in the row', () => {
            const spy = jest.spyOn(LiveVariableUtils, 'getFieldType').mockImplementation((name: string) => (name === 'photo' || name === 'docs' ? 'blob' : 'string'));
            const file = new File(['x'], 'p.png');
            const row: any = { name: 'a', photo: file, docs: [new File(['1'], '1.txt'), new File(['2'], '2.txt')], empty: null };
            const formData: any = LiveVariableUtils.prepareFormData(variable(), row);
            expect(formData.rowData.name).toBe('a');
            expect(formData.get('photo')).not.toBeNull();
            expect(formData.getAll('docs')).toHaveLength(2);
            expect(row.photo).toBe('');
            spy.mockRestore();
        });

        it('keeps null blob values as null', () => {
            const spy = jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('blob');
            const row: any = { photo: null };
            LiveVariableUtils.prepareFormData(variable(), row);
            expect(row.photo).toBeNull();
            spy.mockRestore();
        });
    });
});
