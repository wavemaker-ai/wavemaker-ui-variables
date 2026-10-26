import { LiveVariableUtils } from './live-variable.utils';

describe('LiveVariableUtils.prepareTableOptions - write operations', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(LiveVariableUtils, 'processFilterFields').mockImplementation(() => undefined as any);
        jest.spyOn(LiveVariableUtils, 'generateSearchQuery').mockReturnValue('' as any);
        jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([] as any);
    });

    it('applies the match mode of string typed variable filters', () => {
        const variable: any = {
            operation: 'insert',
            matchMode: 'start',
            filterFields: { name: { value: 'bob' }, other: 'not-an-object' },
            propertiesMap: { columns: [{ fieldName: 'name', type: 'string' }] }
        };
        jest.spyOn(LiveVariableUtils, 'getSQLFieldType').mockReturnValue('string' as any);
        const fieldsSeen: any[] = [];
        (LiveVariableUtils.getFilterOptions as jest.Mock).mockImplementation(((_v: any, fields: any[]) => { fieldsSeen.push(...fields); return []; }) as any);
        LiveVariableUtils.prepareTableOptions(variable, { operation: 'read' });
        expect(fieldsSeen[0].filterCondition).toBeDefined();
        expect(fieldsSeen[0].isVariableFilter).toBe(true);
    });

    it('skips variable filters that are overridden by AND-less runtime filters', () => {
        const variable: any = {
            operation: 'insert',
            filterFields: { name: { value: 'bob' } },
            propertiesMap: { columns: [{ fieldName: 'name', type: 'string' }] }
        };
        jest.spyOn(LiveVariableUtils, 'getSQLFieldType').mockReturnValue('integer' as any);
        const fieldsSeen: any[] = [];
        (LiveVariableUtils.getFilterOptions as jest.Mock).mockImplementation(((_v: any, fields: any[]) => { fieldsSeen.push(...fields); return []; }) as any);
        LiveVariableUtils.prepareTableOptions(variable, { operation: 'read', filterFields: { name: { logicalOp: 'OR', value: 'x', matchMode: 'exact' } } });
        expect(fieldsSeen.filter(f => f.isVariableFilter)).toHaveLength(0);
    });
});

describe('LiveVariableUtils.prepareTableOptions - queries and ordering', () => {
    const variable = (extra: any = {}) => ({
        operation: 'insert',
        ignoreCase: false,
        filterFields: {},
        propertiesMap: { columns: [] },
        ...extra
    } as any);

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('keeps an explicit searchWithQuery choice and skips filter options for non-read operations', () => {
        const options: any = { searchWithQuery: false };
        const result: any = LiveVariableUtils.prepareTableOptions(variable(), options);
        expect(options.searchWithQuery).toBe(false);
        expect(result.filter).toEqual([]);
        expect(result.query).toBeUndefined();
    });

    it('merges variable filter queries with option queries using AND, or uses either alone', () => {
        const filterOptions = [{ isVariableFilter: true, attr: 'v' }, { isVariableFilter: undefined, attr: 'o' }];
        jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue(filterOptions as any);
        const search = jest.spyOn(LiveVariableUtils, 'getSearchQuery');
        search.mockReturnValueOnce('v=1' as any).mockReturnValueOnce('o=2' as any);
        const merged: any = LiveVariableUtils.prepareTableOptions(variable(), { searchWithQuery: true, operation: 'read', logicalOp: 'OR' });
        expect(merged.query).toBe('v=1 AND ( o=2 )');

        search.mockReturnValueOnce('' as any).mockReturnValueOnce('o=2' as any);
        expect((LiveVariableUtils.prepareTableOptions(variable(), { searchWithQuery: true, operation: 'read' }) as any).query).toBe('o=2');

        search.mockReturnValueOnce('v=1' as any).mockReturnValueOnce('' as any);
        expect((LiveVariableUtils.prepareTableOptions(variable(), { searchWithQuery: true, operation: 'read' }) as any).query).toBe('v=1');
    });

    it('does not build a query when no filter options exist or searching without query', () => {
        jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([] as any);
        expect((LiveVariableUtils.prepareTableOptions(variable(), { searchWithQuery: true, operation: 'read' }) as any).query).toBeUndefined();
        jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([{ a: 1 }] as any);
        expect((LiveVariableUtils.prepareTableOptions(variable(), { searchWithQuery: false, operation: 'read' }) as any).query).toBeUndefined();
    });

    it('adds the order by to the table options', () => {
        const ordered: any = LiveVariableUtils.prepareTableOptions(variable({ orderBy: 'name asc' }), {});
        expect(ordered.sort).toBe('sort=name asc');
        const combined: any = LiveVariableUtils.prepareTableOptions(variable({ orderBy: 'name asc' }), { orderBy: 'id desc' });
        expect(combined.sort).toBe('sort=id desc,name asc');
        expect((LiveVariableUtils.prepareTableOptions(variable(), {}) as any).sort).toBe('');
    });
});
