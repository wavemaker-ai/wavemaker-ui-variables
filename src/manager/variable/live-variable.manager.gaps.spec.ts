import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $rootScope } from '../../constants/variables.constants';
import { $queue } from '../../util/inflight-queue';

describe('LiveVariableManager - remaining paths', () => {
    let manager: any;
    let makeCall: jest.SpyInstance;
    const makeVariable = (extra: any = {}) => ({
        name: 'lv',
        liveSource: 'db',
        type: 'Employee',
        maxResults: 10,
        filterFields: {},
        relatedTables: [{ relationName: 'dept', columnName: 'dept', type: 'Department' }, { relationName: 'self', type: 'Employee' }],
        getPrefabName: jest.fn(() => ''),
        notify: jest.fn(),
        httpService: { getLocale: jest.fn() },
        ...extra
    } as any);

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new LiveVariableManager();
        ($queue as any).requestsQueue = new Map();
        ($rootScope as any).project = { id: 'proj', deployedUrl: 'http://app' };
        wmSetDependency('appManager', { getDeployedURL: jest.fn(() => 'http://app'), notify: jest.fn() });
        makeCall = jest.spyOn(manager, 'makeCall');
        jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ query: 'name=x', sort: 'id asc', filter: [] } as any);
        jest.spyOn(LiveVariableUtils, 'getWhereClauseGenerator').mockReturnValue((() => '') as any);
    });

    describe('getAggregatedData', () => {
        it('does nothing without a deployed url', () => {
            wmSetDependency('appManager', { getDeployedURL: () => '' });
            expect(manager.getAggregatedData(makeVariable(), {}, jest.fn(), jest.fn())).toBeUndefined();
        });

        it('adds the filter query and resolves with the response', async () => {
            const response = { type: 4, body: {} };
            makeCall.mockResolvedValue(response);
            const success = jest.fn();
            const options: any = { aggregations: {}, size: 5 };
            await expect(manager.getAggregatedData(makeVariable(), options, success, jest.fn())).resolves.toBe(response);
            expect(options.aggregations.filter).toBe('name=x');
            expect(options.skipEncode).toBe(true);
            expect(success).toHaveBeenCalledWith(response);
            expect(makeCall.mock.calls[0][1]).toBe('executeAggregateQuery');
            expect(makeCall.mock.calls[0][2]).toEqual(expect.objectContaining({ page: 1, size: 5, sort: '', url: 'http://app' }));
        });

        it('works without filter fields or options and defaults the page size', async () => {
            makeCall.mockResolvedValue({ type: 4 });
            await manager.getAggregatedData(makeVariable({ filterFields: undefined }), undefined, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][2].size).toBe(10);
            await manager.getAggregatedData(makeVariable({ filterFields: undefined, maxResults: undefined }), { aggregations: {} }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[1][2].size).toBe(20);
        });

        it('reports response errors and ignores untyped responses', async () => {
            const error = jest.fn();
            makeCall.mockResolvedValue({ type: 4, error: 'bad' });
            manager.getAggregatedData(makeVariable({ filterFields: undefined }), { aggregations: {} }, jest.fn(), error);
            await new Promise(r => setTimeout(r));
            expect(error).toHaveBeenCalledWith('bad');
            makeCall.mockResolvedValue({});
            const success = jest.fn();
            manager.getAggregatedData(makeVariable({ filterFields: undefined }), { aggregations: {} }, success, error);
            await new Promise(r => setTimeout(r));
            expect(success).not.toHaveBeenCalled();
        });

        it('rejects with the call failure', async () => {
            makeCall.mockRejectedValue('boom');
            const error = jest.fn();
            await expect(manager.getAggregatedData(makeVariable({ filterFields: undefined }), { aggregations: {} }, jest.fn(), error)).rejects.toBe('boom');
            expect(error).toHaveBeenCalledWith('boom');
        });
    });

    describe('download', () => {
        const options = (extra: any = {}) => ({ data: { exportSize: 10, exportType: 'CSV', fields: [], ...extra } });

        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        it('requests an export with the query, sort and file name', async () => {
            makeCall.mockResolvedValue({ type: 4, body: { result: '#file' } });
            const success = jest.fn();
            const opts = options({ fileName: 'report' });
            await manager.download(makeVariable(), opts, success, jest.fn());
            const params = makeCall.mock.calls[0][2];
            expect(makeCall.mock.calls[0][1]).toBe('exportTableData');
            expect(params.data).toEqual(expect.objectContaining({ query: 'name=x', exportSize: 10, exportType: 'CSV', fileName: 'report' }));
            expect(params.service).toBe('services');
            expect(params.url).toBe('http://app');
            expect(success).toHaveBeenCalled();
        });

        it('omits the file name and query when absent, and targets prefab urls', async () => {
            (LiveVariableUtils.prepareTableOptions as jest.Mock).mockReturnValue({ sort: 's' });
            makeCall.mockResolvedValue({ type: 4, body: { result: '#file' } });
            await manager.download(makeVariable({ getPrefabName: () => 'pf' }), options(), jest.fn(), jest.fn());
            const params = makeCall.mock.calls[0][2];
            expect(params.data.query).toBe('');
            expect(params.data.fileName).toBeUndefined();
            expect(params.service).toBe('');
            expect(params.url).toBe('http://app/prefabs/pf');
        });

        it('ignores untyped responses and reports failures through the error event and handler', async () => {
            makeCall.mockResolvedValueOnce({});
            manager.download(makeVariable(), options(), jest.fn(), jest.fn());
            const initiate = jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
            makeCall.mockRejectedValue({ error: 'failed', details: { status: 500 } });
            const errorHandler = jest.fn();
            await expect(manager.download(makeVariable(), options(), jest.fn(), errorHandler)).rejects.toEqual({ error: 'failed', details: { status: 500 } });
            expect(errorHandler).toHaveBeenCalledWith('failed');
            expect(initiate).toHaveBeenCalled();
        });
    });

    describe('getRelatedTableData', () => {
        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('string');
            jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([] as any);
            jest.spyOn(LiveVariableUtils, 'getSearchQuery').mockReturnValue('' as any);
            jest.spyOn(LiveVariableUtils, 'processFilterFields').mockImplementation(() => undefined as any);
            jest.spyOn(LiveVariableUtils, 'generateSearchQuery').mockReturnValue('' as any);
        });

        it('splits in/between values, queries the related entity and strips self related columns', async () => {
            makeCall.mockResolvedValue({ type: 4, body: { content: [{ a: 1, self: 'x' }], totalElements: 1 } });
            const success = jest.fn();
            const options: any = { filterFields: { age: { value: '1,2', filterCondition: 'between' }, id: { value: 'a,b', filterCondition: 'in' } }, orderBy: 'id', page: 2, pagesize: 5 };
            await expect(manager.getRelatedTableData(makeVariable(), 'dept', options, success, jest.fn()))
                .resolves.toEqual({ data: [{ a: 1 }], pagination: { totalElements: 1 } });
            expect(options.filterFields.age.value).toEqual(['1', '2']);
            const params = makeCall.mock.calls[0][2];
            expect(makeCall.mock.calls[0][1]).toBe('searchTableDataWithQuery');
            expect(params).toEqual(expect.objectContaining({ entityName: 'Department', sort: 'sort=id', page: 2, size: 5, data: '' }));
            expect(success).toHaveBeenCalled();
        });

        it.each([
            ['both queries', 'a=1', 'b=2', 'q=(a=1) AND (b=2)'],
            ['only the filter fields', 'a=1', '', 'q=a=1'],
            ['only the filter expression', '', 'b=2', 'q=b=2'],
            ['neither', '', '', '']
        ])('combines %s', async (_n, fields, expr, expected) => {
            (LiveVariableUtils.getSearchQuery as jest.Mock).mockReturnValue(fields);
            (LiveVariableUtils.generateSearchQuery as jest.Mock).mockReturnValue(expr);
            makeCall.mockResolvedValue({ type: 4, body: { content: [] } });
            await manager.getRelatedTableData(makeVariable(), 'dept', { filterFields: {}, filterExpr: { rules: [], condition: 'AND' }, logicalOp: 'OR' }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][2].data).toBe(expected);
        });

        it('parses string filter expressions, supports unknown relations and missing options', async () => {
            makeCall.mockResolvedValue({ type: 4, body: { content: [] } });
            await manager.getRelatedTableData(makeVariable({ getPrefabName: () => 'pf' }), 'unknown', { filterFields: {}, filterExpr: '{"rules":[],"condition":"AND"}' }, jest.fn(), jest.fn());
            const params = makeCall.mock.calls[0][2];
            expect(params.entityName).toBe('');
            expect(params.size).toBeUndefined();
            expect(params.url).toBe('http://app/prefabs/pf');
        });

        it('ignores untyped responses and reports failures', async () => {
            makeCall.mockResolvedValueOnce({});
            manager.getRelatedTableData(makeVariable(), 'dept', { filterFields: {} }, jest.fn(), jest.fn());
            makeCall.mockRejectedValue('bad');
            const error = jest.fn();
            await expect(manager.getRelatedTableData(makeVariable(), 'dept', { filterFields: {} }, jest.fn(), error)).rejects.toBe('bad');
            expect(error).toHaveBeenCalledWith('bad');
        });
    });

    describe('getDistinctDataByFields', () => {
        it('requests the distinct values with the generated query, sorting and pagination', async () => {
            makeCall.mockResolvedValue({ type: 4, body: { content: [{ a: 1 }], totalElements: 1 } });
            const success = jest.fn();
            await expect(manager.getDistinctDataByFields(makeVariable(), { fields: 'name', pagesize: 5, entityName: 'Other' }, success, jest.fn()))
                .resolves.toEqual({ data: [{ a: 1 }], pagination: { totalElements: 1 } });
            const params = makeCall.mock.calls[0][2];
            expect(makeCall.mock.calls[0][1]).toBe('getDistinctDataByFields');
            expect(params.data).toEqual({ filter: 'name=x', groupByFields: ['name'] });
            expect(params.sort).toBe('sort=name asc');
            expect(params.entityName).toBe('Other');
            expect(success).toHaveBeenCalled();
        });

        it('handles array fields, explicit sort, prefab urls and no query', async () => {
            (LiveVariableUtils.prepareTableOptions as jest.Mock).mockReturnValue({});
            makeCall.mockResolvedValue({ type: 4, body: { content: [] } });
            await manager.getDistinctDataByFields(makeVariable({ getPrefabName: () => 'pf' }), { fields: ['a', 'b'], sort: 'b desc', page: 3 }, jest.fn(), jest.fn());
            const params = makeCall.mock.calls[0][2];
            expect(params.data).toEqual({ groupByFields: ['a', 'b'] });
            expect(params.sort).toBe('sort=b desc');
            expect(params.page).toBe(3);
            expect(params.url).toBe('http://app/prefabs/pf');
        });

        it('ignores untyped responses and reports failures through the error callback', async () => {
            makeCall.mockResolvedValueOnce({});
            manager.getDistinctDataByFields(makeVariable(), { fields: 'a' }, jest.fn(), jest.fn());
            makeCall.mockRejectedValue('bad');
            const error = jest.fn();
            await expect(manager.getDistinctDataByFields(makeVariable(), { fields: 'a' }, jest.fn(), error)).rejects.toBeDefined();
            expect(error).toHaveBeenCalled();
        });
    });

    it('searchRecords lists the records for the prepared request parameters', () => {
        const list = jest.spyOn(manager, 'listRecords').mockReturnValue('listed');
        jest.spyOn(manager, 'prepareRequestParams').mockReturnValue({ prepared: true });
        const v = makeVariable();
        expect(manager.searchRecords(v, { searchKey: 'k' }, 's', 'e')).toBe('listed');
        expect(list).toHaveBeenCalledWith(v, { prepared: true }, 's', 'e');
    });
});
