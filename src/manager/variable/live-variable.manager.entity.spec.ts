import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $rootScope, CONSTANTS, VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { $queue } from '../../util/inflight-queue';

describe('LiveVariableManager - entity data and composite writes', () => {
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

    describe('listRecords / getEntityData', () => {
        const response = (content: any = [{ id: 1 }]) => ({ type: 4, body: { content, totalElements: content.length } });

        it('queries with the generated query string for searchWithQuery requests', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ query: 'name=x', sort: 's', filter: [] } as any);
            makeCall.mockImplementation(() => Promise.resolve(response()));
            await manager.listRecords(makeVariable({ operation: 'read' }), { searchWithQuery: true }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][1]).toBe('searchTableDataWithQuery');
            expect(makeCall.mock.calls[0][2].data).toBe('q=name=x');
        });

        it('sends an empty query when none could be generated', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [] } as any);
            makeCall.mockImplementation(() => Promise.resolve(response()));
            await manager.listRecords(makeVariable({ operation: 'read' }), { searchWithQuery: true }, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][2].data).toBe('');
        });

        it('switches to the search api when filters exist and reads otherwise', async () => {
            const spy = jest.spyOn(LiveVariableUtils, 'prepareTableOptions');
            spy.mockReturnValue({ sort: 's', filter: [{ a: 1 }] } as any);
            makeCall.mockImplementation(() => Promise.resolve(response()));
            await manager.listRecords(makeVariable(), {}, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][1]).toBe('searchTableData');
            spy.mockReturnValue({ sort: 's', filter: [] } as any);
            await manager.listRecords(makeVariable(), {}, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[1][1]).toBe('readTableData');
        });

        it('replaces the dataset with the result of onPrepareSetData and fires the success events', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [] } as any);
            makeCall.mockImplementation(() => Promise.resolve(response([{ id: 1 }])));
            initiate.mockImplementation(((event: string) => (event === VARIABLE_CONSTANTS.EVENT.PREPARE_SETDATA ? [{ id: 99 }] : undefined)) as any);
            const success = jest.fn();
            const v = makeVariable();
            const result = await manager.listRecords(v, {}, success, jest.fn());
            expect(result.data).toEqual([{ id: 99 }]);
            expect(v.dataSet).toEqual([{ id: 99 }]);
            jest.advanceTimersByTime(10);
            expect(success).toHaveBeenCalledWith([{ id: 99 }], v.propertiesMap, expect.anything());
            expect(v.canUpdate).toBe(true);
        });

        it('rejects responses without content and runs the error handling', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [] } as any);
            makeCall.mockResolvedValue({ type: 4, body: { error: 'bad' } });
            const error = jest.fn();
            await expect(manager.listRecords(makeVariable(), {}, jest.fn(), error)).rejects.toBe('bad');
        });

        it('rejects with the request error', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [] } as any);
            makeCall.mockRejectedValue({ error: 'down', details: { status: 500 } });
            await expect(manager.listRecords(makeVariable(), {}, jest.fn(), jest.fn())).rejects.toBe('down');
        });

        it('uses the design mode page size outside run mode', async () => {
            CONSTANTS.isRunMode = false;
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [] } as any);
            makeCall.mockImplementation(() => Promise.resolve(response()));
            await manager.listRecords(makeVariable({ designMaxResults: 7 }), {}, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[0][2].size).toBe(7);
            await manager.listRecords(makeVariable(), {}, jest.fn(), jest.fn());
            expect(makeCall.mock.calls[1][2].size).toBe(20);
        });
    });

    describe('getDistinctDataByFields error responses', () => {
        it('reports typed responses that carry an error', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({} as any);
            makeCall.mockResolvedValue({ type: 4, error: 'distinct failed', body: {} });
            const error = jest.fn();
            await expect(manager.getDistinctDataByFields(makeVariable(), { fields: 'a' }, jest.fn(), error)).rejects.toBe('distinct failed');
            expect(error).toHaveBeenCalledWith('distinct failed');
        });
    });

    describe('composite key writes with other actions', () => {
        it('keeps the original action when it has no composite variant', async () => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['a', 'b'] as any);
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(true as any);
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('string' as any);
            jest.spyOn(LiveVariableUtils, 'getCompositeIDURL').mockReturnValue('a=1' as any);
            makeCall.mockResolvedValue({ type: 4, body: {} });
            manager.doCUD('insertTableData', makeVariable({ propertiesMap: { columns: [], primaryFields: ['a', 'b'] } }), { row: { a: 1 }, compositeKeysData: { a: 1 } }, jest.fn(), jest.fn());
            await Promise.resolve();
            expect(makeCall.mock.calls[0][1]).toBe('insertTableData');
        });
    });

    describe('composite key writes', () => {
        beforeEach(() => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['a', 'b'] as any);
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(true as any);
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('string' as any);
            jest.spyOn(LiveVariableUtils, 'getCompositeIDURL').mockReturnValue('a=1&b=2' as any);
            jest.spyOn(LiveVariableUtils, 'prepareFormData').mockImplementation(((_v: any, row: any) => row) as any);
        });

        it.each([
            ['updateTableData', 'updateCompositeTableData'],
            ['deleteTableData', 'deleteCompositeTableData']
        ])('uses the composite %s api when composite keys are provided', async (action, expected) => {
            makeCall.mockResolvedValue({ type: 4, body: {} });
            const v = makeVariable({ propertiesMap: { columns: [], primaryFields: ['a', 'b'] } });
            const promise = manager.doCUD(action, v, { row: { a: 1, b: 2 }, compositeKeysData: { a: 1, b: 2 }, prevData: { a: 1, b: 2 } }, jest.fn(), jest.fn());
            await Promise.race([promise, Promise.resolve()]);
            expect(makeCall).toHaveBeenCalled();
            expect(makeCall.mock.calls[0][1]).toBe(expected);
        });
    });
});

describe('LiveVariableManager.handleError', () => {
    it('gives every failed variable its own empty dataset', () => {
        const manager: any = new LiveVariableManager();
        jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
        const first: any = { propertiesMap: {}, pagination: null };
        const second: any = { propertiesMap: {}, pagination: null };
        manager.handleError(first, jest.fn(), 'e1', {});
        expect(() => manager.handleError(second, jest.fn(), 'e2', {})).not.toThrow();
        expect(first.dataSet).toEqual([]);
        expect(second.dataSet).toEqual([]);
        expect(first.dataSet).not.toBe(second.dataSet);
        // the legacy accessors belong to their own variable
        first.pagination = { p: 1 };
        expect((first.dataSet as any).pagination).toEqual({ p: 1 });
        expect((second.dataSet as any).pagination).toBeNull();
    });
});
