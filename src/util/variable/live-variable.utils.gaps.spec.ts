import { LiveVariableUtils } from './live-variable.utils';
import { $rootScope } from '../../constants/variables.constants';

describe('LiveVariableUtils - remaining paths', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        ($rootScope as any).project = { deployedUrl: 'http://app' };
    });

    afterEach(() => {
        delete (window as any).cordova;
    });

    describe('processBlobColumns', () => {
        const variable = (extra: any = {}) => ({
            liveSource: 'db',
            type: 'Emp',
            _prefabName: '',
            propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }], primaryFields: ['id'] },
            ...extra
        });

        it('builds content urls for empty blob columns', () => {
            const data: any = [{ id: 7, photo: '' }, { id: 8, photo: null }, { id: 9, photo: 'kept' }, null];
            LiveVariableUtils.processBlobColumns(data, variable());
            expect(data[0].photo).toBe('services/db/Emp/7/content/photo');
            expect(data[1].photo).toBeNull();
            expect(data[2].photo).toBe('kept');
        });

        it('prefixes the deployed url on cordova, with or without a trailing slash', () => {
            (window as any).cordova = {};
            const withSlash: any = [{ id: 1, photo: '' }];
            ($rootScope as any).project = { deployedUrl: 'http://app/' };
            LiveVariableUtils.processBlobColumns(withSlash, variable());
            expect(withSlash[0].photo).toBe('http://app/services/db/Emp/1/content/photo');
            const withoutSlash: any = [{ id: 1, photo: '' }];
            ($rootScope as any).project = { deployedUrl: 'http://app' };
            LiveVariableUtils.processBlobColumns(withoutSlash, variable());
            expect(withoutSlash[0].photo).toBe('http://app/services/db/Emp/1/content/photo');
        });

        it('uses prefab urls and primary keys, and builds composite ids', () => {
            const prefab: any = [{ id: 1, photo: '' }];
            LiveVariableUtils.processBlobColumns(prefab, variable({ _prefabName: 'pf', propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }], primaryKeys: ['id'] } }));
            expect(prefab[0].photo).toBe('prefabs/pf/db/Emp/1/content/photo');

            const composite: any = [{ a: 1, b: 2, photo: '' }];
            LiveVariableUtils.processBlobColumns(composite, variable({ propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }], primaryFields: ['a', 'b'] } }));
            expect(composite[0].photo).toContain('composite-id/content/photo?');
        });

        it('does nothing without data or blob columns', () => {
            expect(() => LiveVariableUtils.processBlobColumns(undefined, variable())).not.toThrow();
            const data: any = [{ photo: '' }];
            LiveVariableUtils.processBlobColumns(data, variable({ propertiesMap: { columns: [] } }));
            expect(data[0].photo).toBe('');
        });
    });

    describe('prepareTableOptionsForFilterExps', () => {
        const variable = (extra: any = {}) => ({
            operation: 'read',
            ignoreCase: false,
            orderBy: undefined,
            filterExpressions: { condition: 'AND', rules: [] },
            propertiesMap: { columns: [{ fieldName: 'name', type: 'string' }, { fieldName: 'age', type: 'integer' }] },
            ...extra
        });

        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'processFilterFields').mockImplementation(() => undefined as any);
            jest.spyOn(LiveVariableUtils, 'generateSearchQuery').mockImplementation(((rules: any, condition: any) => JSON.stringify({ rules, condition })) as any);
        });

        it('uses the live filter expression when present', () => {
            const options: any = { filterExpr: { condition: 'OR', rules: [{ target: 'x' }] } };
            const result: any = LiveVariableUtils.prepareTableOptionsForFilterExps(variable(), options, undefined);
            expect(JSON.parse(result.query)).toEqual({ rules: [{ target: 'x' }], condition: 'OR' });
            expect(options.searchWithQuery).toBe(true);
        });

        it('turns runtime filter fields into rules (operator, match modes, empty values and defaults)', () => {
            const options: any = {
                logicalOp: undefined,
                filterFields: {
                    name: { value: 'bob', logicalOp: 'OR', matchMode: 'start' },
                    age: { value: 30 },
                    skipped: { value: '' },
                    nulled: { value: null },
                    gone: null,
                    empty: { filterCondition: 'null' }
                }
            };
            jest.spyOn(LiveVariableUtils, 'getSqlType').mockImplementation(((_v: any, name: string) => (name === 'name' ? 'string' : 'integer')) as any);
            const result: any = LiveVariableUtils.prepareTableOptionsForFilterExps(variable({ filterExpressions: undefined }), options, undefined);
            const parsed = JSON.parse(result.query);
            expect(parsed.condition).toBe('OR');
            const targets = parsed.rules.map((r: any) => r.target);
            expect(targets).toEqual(expect.arrayContaining(['name', 'age']));
            expect(targets).not.toContain('skipped');
            expect(targets).not.toContain('nulled');
            expect(parsed.rules.find((r: any) => r.target === 'age').matchMode).toBe('exact');
            expect(parsed.rules.find((r: any) => r.target === 'name').matchMode).toBe('start');
        });

        it('combines the variable expression with runtime filters using AND', () => {
            const options: any = { filterFields: { age: { value: 3, type: 'integer' } }, logicalOp: 'AND' };
            const result: any = LiveVariableUtils.prepareTableOptionsForFilterExps(
                variable(), options, { condition: 'OR', rules: [{ target: 'name', value: 'x' }] });
            const parsed = JSON.parse(result.query);
            expect(parsed.condition).toBe('AND');
            expect(parsed.rules).toHaveLength(2);
        });

        it('keeps the variable expression when there are no runtime filters', () => {
            const result: any = LiveVariableUtils.prepareTableOptionsForFilterExps(variable(), { filterFields: {} }, { condition: 'AND', rules: [{ target: 'a' }] });
            expect(JSON.parse(result.query).rules).toEqual([{ target: 'a' }]);
        });

        it('adds the sort option from the order by', () => {
            const result: any = LiveVariableUtils.prepareTableOptionsForFilterExps(variable({ orderBy: 'name asc' }), {}, undefined);
            expect(result.sort).toBe('sort=name asc');
            const none: any = LiveVariableUtils.prepareTableOptionsForFilterExps(variable(), {}, undefined);
            expect(none.sort).toBe('');
        });
    });

    describe('getWhereClauseGenerator', () => {
        const variable: any = { filterExpressions: { condition: 'AND', rules: [] }, operation: 'read' };

        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ query: 'q' } as any);
        });

        it('returns the query for the current filters', () => {
            expect(LiveVariableUtils.getWhereClauseGenerator(variable, {})(undefined)).toBe('q');
        });

        it('lets a modifier change the filter fields (with and without runtime filter fields)', () => {
            const modifier = jest.fn();
            const options: any = {};
            LiveVariableUtils.getWhereClauseGenerator(variable, options)(modifier);
            expect(modifier).toHaveBeenCalledWith(expect.anything());
            expect(modifier.mock.calls[0]).toHaveLength(1);

            const withFilters: any = { filterFields: { a: 1 } };
            LiveVariableUtils.getWhereClauseGenerator(variable, withFilters)(modifier);
            expect(modifier.mock.calls[1]).toHaveLength(2);
            expect(modifier.mock.calls[1][1]).toBe(withFilters);
        });

        it('honours the skip encode flag and updated filter fields', () => {
            const options: any = {};
            LiveVariableUtils.getWhereClauseGenerator(variable, options, { condition: 'OR', rules: [] })(undefined, true);
            expect(options.skipEncode).toBe(true);
            LiveVariableUtils.getWhereClauseGenerator(variable, options)(undefined, false);
            expect(options.skipEncode).toBe(false);
        });
    });
});
