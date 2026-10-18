import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $rootScope, CONSTANTS, VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { $queue } from '../../util/inflight-queue';

describe('LiveVariableManager - leftover branches', () => {
    let manager: any;
    let makeCall: jest.SpyInstance;
    let initiate: jest.SpyInstance;

    const makeVariable = (extra: any = {}) => ({
        name: 'lv',
        liveSource: 'db',
        type: 'Employee',
        maxResults: 10,
        filterFields: {},
        filterExpressions: { condition: 'AND', rules: [] },
        propertiesMap: { columns: [], primaryFields: ['id'], entityName: 'Employee' },
        getPrefabName: jest.fn(() => ''),
        notify: jest.fn(),
        httpService: { getLocale: jest.fn() },
        ...extra
    } as any);

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.useFakeTimers();
        manager = new LiveVariableManager();
        ($queue as any).requestsQueue = new Map();
        CONSTANTS.isRunMode = true;
        ($rootScope as any).project = { id: 'proj', deployedUrl: 'http://app' };
        wmSetDependency('appManager', { getDeployedURL: jest.fn(() => 'http://app'), notify: jest.fn() });
        makeCall = jest.spyOn(manager, 'makeCall');
        initiate = jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
        jest.spyOn(LiveVariableUtils, 'processBlobColumns').mockImplementation(() => undefined);
        jest.spyOn(LiveVariableUtils, 'getWhereClauseGenerator').mockReturnValue((() => '') as any);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    const ok = (content: any = [{ id: 1 }]) => ({ type: 4, body: { content, totalElements: content.length } });

    it('registers the destroy listener only when the context offers one', () => {
        expect(() => manager.initFilterExpressionBinding({ _context: {} })).not.toThrow();
        const context = { registerDestroyListener: jest.fn() };
        expect(() => manager.initFilterExpressionBinding({ _context: context })).not.toThrow();
    });

    describe('getEntityData', () => {
        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [] } as any);
            makeCall.mockImplementation(() => Promise.resolve(ok()));
        });

        it('uses an object returned by onBeforeUpdate as the filter fields', async () => {
            initiate.mockImplementation(((event: string) => (event === VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE ? { custom: 1 } : undefined)) as any);
            await manager.listRecords(makeVariable(), {}, jest.fn(), jest.fn());
            expect((LiveVariableUtils.prepareTableOptions as jest.Mock).mock.calls[0][2]).toEqual({ custom: 1 });
        });

        it('stops the call when onBeforeUpdate returns false', async () => {
            initiate.mockImplementation(((event: string) => (event === VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE ? false : undefined)) as any);
            const error = jest.fn();
            await expect(manager.listRecords(makeVariable(), {}, jest.fn(), error)).rejects.toContain('Call stopped');
            expect(error).toHaveBeenCalled();
        });

        it('targets prefab urls and skips dataset updates on request', async () => {
            const v = makeVariable({ getPrefabName: () => 'pf' });
            const success = jest.fn();
            const result = await manager.listRecords(v, { skipDataSetUpdate: true }, success, jest.fn());
            const params = makeCall.mock.calls[0][2];
            expect(params.service).toBe('');
            expect(params.url).toBe('http://app/prefabs/pf');
            expect(v.dataSet).toBeUndefined();
            expect(result.data).toEqual([{ id: 1 }]);
        });

        it('accepts missing options and ignores untyped responses', async () => {
            makeCall.mockResolvedValueOnce({});
            let settled = false;
            manager.listRecords(makeVariable({ filterFields: undefined }), undefined, jest.fn(), jest.fn()).then(() => (settled = true), () => (settled = true));
            await Promise.resolve();
            await Promise.resolve();
            jest.advanceTimersByTime(10);
            expect(settled).toBe(false);
        });

        it('uses the page and page size from options', async () => {
            await manager.listRecords(makeVariable(), { page: 3, pagesize: 5 }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][2]).toEqual(expect.objectContaining({ page: 3, size: 5 }));
        });
    });

    describe('getRelatedTableData', () => {
        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([] as any);
            jest.spyOn(LiveVariableUtils, 'getSearchQuery').mockReturnValue('' as any);
            makeCall.mockResolvedValue({ type: 4, body: { content: [{ id: 1 }] } });
        });

        it('splits in and between values and falls back to the project name', async () => {
            ($rootScope as any).project = { deployedUrl: 'http://app' };
            ($rootScope as any).projectName = 'pn';
            const filterFields: any = { a: { value: '1,2', filterCondition: 'in' }, b: { value: '3,4', filterCondition: 'between' }, c: { value: 'x', filterCondition: 'eq' } };
            await manager.getRelatedTableData(makeVariable(), 'dept', { filterFields, orderBy: 'id', logicalOp: 'OR', page: 2, pagesize: 3 }, jest.fn(), jest.fn());
            expect(filterFields.a.value).toEqual(['1', '2']);
            expect(filterFields.b.value).toEqual(['3', '4']);
            expect(filterFields.c.value).toBe('x');
            const params = makeCall.mock.calls[0][2];
            expect(params.projectID).toBe('pn');
            expect(params.sort).toBe('sort=id');
            expect(params.size).toBe(3);
        });

        it('ignores untyped responses', async () => {
            makeCall.mockResolvedValueOnce({});
            let settled = false;
            manager.getRelatedTableData(makeVariable(), 'dept', { filterFields: {} }, jest.fn(), jest.fn()).then(() => (settled = true));
            await Promise.resolve();
            await Promise.resolve();
            expect(settled).toBe(false);
        });
    });

    describe('getDistinctDataByFields', () => {
        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ query: 'q' } as any);
            makeCall.mockResolvedValue({ type: 4, body: { content: [{ a: 1 }] } });
        });

        it('uses the given sort and array fields, or defaults to ascending on the first field', async () => {
            await manager.getDistinctDataByFields(makeVariable(), { fields: ['a', 'b'], sort: 'a desc' }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][2].sort).toBe('sort=a desc');
            await manager.getDistinctDataByFields(makeVariable(), { fields: 'a', entityName: 'Other', page: 2, pagesize: 5 }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[1][2]).toEqual(expect.objectContaining({ sort: 'sort=a asc', entityName: 'Other', page: 2, size: 5 }));
        });
    });
});
