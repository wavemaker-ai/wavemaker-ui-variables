import { CrudVariableManager } from './crud-variable.manager';
import { $rootScope } from '../../constants/variables.constants';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';

describe('CrudVariableManager - pagination passthrough', () => {
    let manager: any;

    const operation = () => ({
        operationType: 'list',
        wmServiceOperationInfo: {
            directPath: 'http://host/api/users',
            relativePath: '/api/users',
            httpMethod: 'GET',
            proxySettings: { web: false },
            parameters: []
        }
    });

    const variable = (overrides: any = {}): any => ({
        name: 'crud1',
        crudOperationId: 'c1',
        serviceType: 'RestService',
        dataBinding: {},
        maxResults: 10,
        paginationTransformationRequired: true,
        getPrefabName: () => undefined,
        httpService: { getLocale: () => ({}) },
        _context: { Actions: {} },
        ...overrides
    });

    const run = (v: any, options: any) => manager._invoke(v, options, jest.fn(), jest.fn());

    beforeEach(() => {
        manager = new CrudVariableManager();
        wmSetDependency('appManager', { notify: jest.fn() });
        wmSetDependency('metadata', { getByCrudId: () => [operation()] });
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        ($queue as any).requestsQueue = new Map();
        jest.spyOn(manager, 'httpCall').mockResolvedValue({ type: 'ok', body: '{"items":[1,2],"total":5}', headers: {} });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
        jest.spyOn(manager, 'processSuccessResponse').mockReturnValue({ id: 1 });
        jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('passes the response through unchanged when transformation is required', async () => {
        const lookup = jest.spyOn(manager, 'getPaginationInfo');
        await expect(run(variable(), { operation: 'list', inputFields: {} })).resolves.toBeDefined();
        expect(lookup).not.toHaveBeenCalled();
        expect(manager.processSuccessResponse.mock.calls[0][0]).toBe('{"items":[1,2],"total":5}');
    });

    it('does not look up pagination metadata when no transformation is required', async () => {
        const lookup = jest.spyOn(manager, 'getPaginationInfo');
        await run(variable({ paginationTransformationRequired: false }), { operation: 'list', inputFields: {} });
        expect(lookup).not.toHaveBeenCalled();
        expect(manager.processSuccessResponse.mock.calls[0][0]).toBe('{"items":[1,2],"total":5}');
    });
});
