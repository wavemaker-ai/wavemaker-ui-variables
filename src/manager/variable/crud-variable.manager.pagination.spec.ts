import { CrudVariableManager } from './crud-variable.manager';
import { $rootScope } from '../../constants/variables.constants';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';

describe('CrudVariableManager - pagination transformation', () => {
    let manager: any;
    let httpCall: jest.SpyInstance;

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

    const paginationInfo = {
        contentMapping: 'items',
        pageMapping: { name: 'pageNum' },
        sizeMapping: { name: 'limit' }
    };

    const run = (v: any, options: any) => manager._invoke(v, options, jest.fn(), jest.fn());
    const transformedBody = () => JSON.parse(manager.processSuccessResponse.mock.calls[0][0]);

    beforeEach(() => {
        manager = new CrudVariableManager();
        wmSetDependency('appManager', { notify: jest.fn() });
        wmSetDependency('metadata', { getByCrudId: () => [operation()] });
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        ($queue as any).requestsQueue = new Map();
        httpCall = jest.spyOn(manager, 'httpCall').mockResolvedValue({ type: 'ok', body: '{"items":[1,2],"total":5}', headers: {} });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
        jest.spyOn(manager, 'processSuccessResponse').mockReturnValue({ id: 1 });
        jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
    });

    afterEach(() => jest.restoreAllMocks());

    it('wraps the response into a page when pagination metadata is available', async () => {
        jest.spyOn(manager, 'getPaginationInfo').mockReturnValue(paginationInfo);
        await run(variable(), { operation: 'list', inputFields: { pageNum: 1, limit: 10, totalMapping: 'total' } });
        expect(httpCall).toHaveBeenCalled();
        expect(transformedBody()).toEqual({
            content: [1, 2],
            first: true,
            last: false,
            number: 0,
            numberOfElements: 10,
            size: 10,
            sort: null,
            totalElements: 5,
            totalPages: 1
        });
    });

    it('marks the last page and adds sort information', async () => {
        jest.spyOn(manager, 'getPaginationInfo').mockReturnValue(paginationInfo);
        await run(variable(), { operation: 'list', orderBy: 'name asc', inputFields: { pageNum: 5, limit: 2, totalMapping: 'total' } });
        const body = transformedBody();
        expect(body.last).toBe(true);
        expect(body.first).toBe(false);
        expect(body.sort).toEqual([{ direction: 'ASC', property: 'name', ignoreCase: false, nullHandling: 'NATIVE', ascending: true }]);
        await run(variable(), { operation: 'list', orderBy: 'age desc', inputFields: { pageNum: 1, limit: 2, totalMapping: 'total' } });
        expect(JSON.parse(manager.processSuccessResponse.mock.calls[1][0]).sort[0]).toEqual(expect.objectContaining({ direction: 'DESC', ascending: false }));
    });

    it('leaves the response untouched when the operation has no pagination metadata', async () => {
        jest.spyOn(manager, 'getPaginationInfo').mockReturnValue(null);
        await expect(run(variable(), { operation: 'list', inputFields: {} })).resolves.toBeDefined();
        expect(manager.processSuccessResponse.mock.calls[0][0]).toBe('{"items":[1,2],"total":5}');
    });

    it('does not look up pagination metadata when no transformation is required', async () => {
        const lookup = jest.spyOn(manager, 'getPaginationInfo');
        await run(variable({ paginationTransformationRequired: false }), { operation: 'list', inputFields: {} });
        expect(lookup).not.toHaveBeenCalled();
        expect(manager.processSuccessResponse.mock.calls[0][0]).toBe('{"items":[1,2],"total":5}');
    });
});
