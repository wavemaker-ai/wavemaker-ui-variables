const mockManager: Record<string, jest.Mock> = {};
[
    'listRecords', 'updateRecord', 'insertRecord', 'deleteRecord', 'setInput', 'setFilter', 'download',
    'getRelatedTablePrimaryKeys', 'getRelatedTableData', 'getDistinctDataByFields', 'getAggregatedData',
    'getPrimaryKey', 'searchRecords', 'prepareRequestParams', 'downgradeFilterExpressionsToInputData',
    'upgradeInputDataToFilterExpressions', 'initBinding', 'initFilterExpressionBinding', 'defineFirstLastRecord', 'cancel'
].forEach(name => (mockManager[name] = jest.fn(() => name)));

const mockDebounce = jest.fn();

jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn(() => mockManager) }
}));
jest.mock('../../util/variable/variables.utils', () => ({
    ...jest.requireActual('../../util/variable/variables.utils'),
    debounceVariableCall: (...a: any[]) => mockDebounce(...a)
}));

import { DataSource } from '../../types/types';
import { LiveVariable } from './live-variable';

describe('LiveVariable', () => {
    const make = (extra: any = {}) => new LiveVariable({
        name: 'lv', liveSource: 'db', type: 'Employee', operation: 'read',
        propertiesMap: { entityName: 'Employee' }, httpClientService: { http: 1 }, ...extra
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('uses the supplied http client service', () => {
        expect(make().httpService).toEqual({ http: 1 });
    });

    describe('execute', () => {
        it('answers base operations first', () => {
            expect(make().execute(DataSource.Operation.GET_NAME, {})).toBe('lv');
        });

        it.each([
            DataSource.Operation.IS_API_AWARE,
            DataSource.Operation.SUPPORTS_CRUD,
            DataSource.Operation.SUPPORTS_DISTINCT_API,
            DataSource.Operation.IS_PAGEABLE,
            DataSource.Operation.IS_SORTABLE,
            DataSource.Operation.SUPPORTS_SERVER_FILTER,
            DataSource.Operation.IS_UPDATE_REQUIRED
        ])('supports %s', op => {
            expect(make().execute(op, {})).toBe(true);
        });

        it.each([DataSource.Operation.IS_BOUND_TO_LOCALE, DataSource.Operation.CANCEL])('answers false for %s', op => {
            expect(make().execute(op, {})).toBe(false);
        });

        it('exposes configuration values', () => {
            const v: any = make({ matchMode: 'anywhere', pagination: { p: 1 }, _options: { o: 1 }, operationType: 'x' });
            expect(v.execute(DataSource.Operation.GET_OPERATION_TYPE, {})).toBe('read');
            expect(v.execute(DataSource.Operation.GET_ENTITY_NAME, {})).toBe('Employee');
            expect(v.execute(DataSource.Operation.GET_MATCH_MODE, {})).toBe('anywhere');
            expect(v.execute(DataSource.Operation.GET_PROPERTIES_MAP, {})).toEqual({ entityName: 'Employee' });
            expect(v.execute(DataSource.Operation.GET_PAGING_OPTIONS, {})).toEqual({ p: 1 });
            expect(v.execute(DataSource.Operation.GET_OPTIONS, {})).toEqual({ o: 1 });
            expect(make().execute(DataSource.Operation.GET_OPTIONS, {})).toEqual({});
            expect(v.execute(DataSource.Operation.GET_BLOB_URL, { primaryValue: 5, columnName: 'photo' })).toBe('services/db/Employee/5/content/photo');
        });

        it('routes data operations to the manager', () => {
            const v = make();
            const check = (op: any, options: any, method: string) => {
                expect(v.execute(op, options)).toBe(method);
                expect(mockManager[method]).toHaveBeenCalled();
            };
            check(DataSource.Operation.GET_RELATED_PRIMARY_KEYS, 'col', 'getRelatedTablePrimaryKeys');
            check(DataSource.Operation.LIST_RECORDS, {}, 'listRecords');
            check(DataSource.Operation.UPDATE_RECORD, {}, 'updateRecord');
            check(DataSource.Operation.INSERT_RECORD, {}, 'insertRecord');
            check(DataSource.Operation.DELETE_RECORD, {}, 'deleteRecord');
            check(DataSource.Operation.GET_RELATED_TABLE_DATA, { relatedField: 'f' }, 'getRelatedTableData');
            check(DataSource.Operation.GET_DISTINCT_DATA_BY_FIELDS, {}, 'getDistinctDataByFields');
            check(DataSource.Operation.GET_AGGREGATED_DATA, {}, 'getAggregatedData');
            check(DataSource.Operation.DOWNLOAD, {}, 'download');
            check(DataSource.Operation.GET_PRIMARY_KEY, {}, 'getPrimaryKey');
            check(DataSource.Operation.SEARCH_RECORDS, {}, 'searchRecords');
            check(DataSource.Operation.GET_REQUEST_PARAMS, {}, 'prepareRequestParams');
            expect(mockManager.getRelatedTableData).toHaveBeenCalledWith(v, 'f', { relatedField: 'f' }, undefined, undefined);
        });

        it('invoke and update follow the configured operation', () => {
            expect(make({ operation: 'read' }).execute(DataSource.Operation.INVOKE, {})).toBe('listRecords');
            expect(make({ operation: 'insert' }).execute(DataSource.Operation.UPDATE, {})).toBe('insertRecord');
        });

        it('returns an empty object for unknown operations', () => {
            expect(make().execute('unknown' as any, {})).toEqual({});
        });
    });

    describe('invoke', () => {
        it.each([
            ['insert', 'insertRecord'],
            ['update', 'updateRecord'],
            ['delete', 'deleteRecord'],
            ['read', 'listRecords'],
            [undefined, 'listRecords']
        ])('runs the %s operation through %s', (operation, method) => {
            const v: any = make({ operation });
            v.invoke({ a: 1 }, 's', 'e');
            expect(mockManager[method]).toHaveBeenCalledWith(v, { a: 1 }, 's', 'e');
        });
    });

    describe('manager delegates', () => {
        it('forwards calls with their arguments', () => {
            const v: any = make();
            v.setInput('k', 'v', {});
            expect(mockManager.setInput).toHaveBeenCalledWith(v, 'k', 'v', {});
            v.setFilter('k', 'v');
            expect(mockManager.setFilter).toHaveBeenCalledWith(v, 'k', 'v');
            v.createRecord({ c: 1 }, 's', 'e');
            expect(mockManager.insertRecord).toHaveBeenCalledWith(v, { c: 1 }, 's', 'e');
            v.update({ u: 1 });
            expect(mockManager.listRecords).toHaveBeenCalled();
            v._downgradeInputData({ d: 1 });
            expect(mockManager.downgradeFilterExpressionsToInputData).toHaveBeenCalledWith(v, { d: 1 });
            v._upgradeInputData('resp', { d: 2 });
            expect(mockManager.upgradeInputDataToFilterExpressions).toHaveBeenCalledWith(v, 'resp', { d: 2 });
            v.cancel({ c: 1 });
            expect(mockManager.cancel).toHaveBeenCalledWith(v, { c: 1 });
            v.getAggregatedData({}, 's', 'e');
            v.getDistinctDataByFields({}, 's', 'e');
            v.searchRecords({}, 's', 'e');
            v.getRelatedTableData('col', {}, 's', 'e');
        });

        it('stores the order by expression', () => {
            const v = make();
            expect(v.setOrderBy('name asc')).toBe('name asc');
            expect(v.orderBy).toBe('name asc');
        });
    });

    describe('init', () => {
        it('binds filter fields and filter expressions for read operations', () => {
            const v = make({ operation: 'read' });
            v.init();
            expect(mockManager.initBinding).toHaveBeenCalledWith(v, 'dataBinding', 'filterFields');
            expect(mockManager.initFilterExpressionBinding).toHaveBeenCalledWith(v);
            expect(mockManager.defineFirstLastRecord).toHaveBeenCalledWith(v);
        });

        it('binds input fields for write operations', () => {
            const v = make({ operation: 'insert' });
            v.init();
            expect(mockManager.initBinding).toHaveBeenCalledWith(v, 'dataBinding', 'inputFields');
            expect(mockManager.initFilterExpressionBinding).not.toHaveBeenCalled();
        });
    });

    describe('invokeOnFiltertExpressionChange', () => {
        it('ignores changes that carry no information', () => {
            const v: any = make({ autoUpdate: true });
            v.invokeOnFiltertExpressionChange({ type: 'string' }, 'value', undefined, undefined);
            v.invokeOnFiltertExpressionChange({ type: 'string' }, 'value', undefined, 'old');
            expect(mockDebounce).not.toHaveBeenCalled();
        });

        it('writes the new value into the bound node and schedules an update for read variables', () => {
            const v: any = make({ autoUpdate: true });
            const node: any = { type: 'string', target: 'rules[0]' };
            v.invokeOnFiltertExpressionChange(node, 'value', 'new', 'old');
            expect(node.value).toBe('new');
            expect(mockDebounce).toHaveBeenCalledWith(v, 'update');
        });

        it('does not clone blob and file values', () => {
            const v: any = make();
            const blob = { x: 1 };
            const node: any = { type: 'blob', target: 'rules[0]' };
            v.invokeOnFiltertExpressionChange(node, 'value', blob, undefined);
            expect(node.value).toBe(blob);
            const cloned: any = { type: 'string', target: 'rules[0]' };
            v.invokeOnFiltertExpressionChange(cloned, 'value', blob, undefined);
            expect(cloned.value).not.toBe(blob);
            expect(cloned.value).toEqual(blob);
        });

        it('does not schedule an update without autoUpdate', () => {
            make().invokeOnFiltertExpressionChange({ type: 'string', target: 't' }, 'v', 'a', 'b');
            expect(mockDebounce).not.toHaveBeenCalled();
        });

        it('schedules the matching record operation for write variables', () => {
            const v: any = make({ operation: 'insert', autoUpdate: true });
            v.invokeOnFiltertExpressionChange({ type: 'string', target: 't' }, 'v', 'a', 'b');
            expect(mockDebounce).toHaveBeenCalledWith(v, 'insertRecord');
            mockDebounce.mockClear();
            const unknown: any = make({ operation: 'noop', autoUpdate: true });
            unknown.invokeOnFiltertExpressionChange({ type: 'string', target: 't' }, 'v', 'a', 'b');
            expect(mockDebounce).not.toHaveBeenCalled();
        });

        it('replaces the rules when a whole object is bound to the data binding', () => {
            const v: any = make({ filterExpressions: { rules: [{ old: true }] } });
            v.invokeOnFiltertExpressionChange({ type: 'string', target: 'dataBinding', matchMode: 'exact' }, 'v', { a: 1, b: 'x' }, undefined);
            expect(v.filterExpressions.rules).toEqual([
                { target: 'a', value: 1, matchMode: 'exact', required: false, type: '' },
                { target: 'b', value: 'x', matchMode: 'exact', required: false, type: '' }
            ]);
        });

        it('defaults the match mode and clears the rules when the bound object is empty', () => {
            const v: any = make({ filterExpressions: { rules: [{ old: true }] } });
            v.invokeOnFiltertExpressionChange({ type: 'string', target: 'dataBinding' }, 'v', { a: 1 }, undefined);
            expect(v.filterExpressions.rules[0].matchMode).toBe('startignorecase');
            v.invokeOnFiltertExpressionChange({ type: 'string', target: 'dataBinding' }, 'v', {}, 'x');
            expect(v.filterExpressions.rules).toEqual([]);
        });
    });
});
