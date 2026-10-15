import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $rootScope, CONSTANTS, VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { $queue } from '../../util/inflight-queue';

describe('LiveVariableManager - final branches', () => {
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

    beforeEach(() => {
        jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ sort: 's', filter: [], query: 'q' } as any);
        jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([] as any);
        jest.spyOn(LiveVariableUtils, 'getSearchQuery').mockReturnValue('' as any);
    });

    it('reads entity data from responses that only carry data', async () => {
        makeCall.mockResolvedValue({ status: 200, data: { content: [{ id: 1 }], totalElements: 1 } });
        const result = await manager.listRecords(makeVariable(), {}, jest.fn(), jest.fn());
        expect(result.data).toEqual([{ id: 1 }]);
    });

    it('fails to download without options', () => {
        expect(() => manager.download(makeVariable(), undefined, jest.fn(), jest.fn())).toThrow();
    });

    it('falls back to the project name when the project has no id', async () => {
        ($rootScope as any).project = { deployedUrl: 'http://app' };
        ($rootScope as any).projectName = 'pn';
        makeCall.mockResolvedValue({ type: 4, body: { result: '#f', content: [] } });
        await manager.download(makeVariable(), { data: { exportSize: 1, exportType: 'CSV', fields: [] } }, jest.fn(), jest.fn());
        expect(makeCall.mock.calls[0][2].projectID).toBe('pn');
        await manager.getDistinctDataByFields(makeVariable(), { fields: 'a' }, jest.fn(), jest.fn());
        expect(makeCall.mock.calls[1][2].projectID).toBe('pn');
    });

    it('reads related table data from responses that only carry data', async () => {
        makeCall.mockResolvedValue({ status: 200, data: { content: [{ id: 1 }] } });
        const success = jest.fn();
        await manager.getRelatedTableData(makeVariable(), 'dept', { filterFields: {} }, success, jest.fn());
        expect(success).toHaveBeenCalledWith(expect.objectContaining({ data: [{ id: 1 }] }));
    });
});
